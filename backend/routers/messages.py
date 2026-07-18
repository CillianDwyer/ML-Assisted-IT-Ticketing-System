# routers/messages.py
# Public ticket messages, private assist messages and attachments.

import os
import uuid

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import or_

import auth
import models
import schemas
from constants import MAX_ATTACHMENT_BYTES, UPLOAD_DIR
from database import get_db
from notify import create_notification, notify_ticket_participants
from ticket_logic import can_access_ticket, extract_mentioned_email
from timeutils import utcnow

router = APIRouter(tags=["messages"])


def _get_accessible_ticket(db: Session, ticket_id: int, current_user: models.User) -> models.Ticket:
    ticket = db.query(models.Ticket).filter(models.Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    if not can_access_ticket(ticket, current_user, db):
        raise HTTPException(status_code=403, detail="Not authorized")
    return ticket


def _resolve_private_recipient(
    db: Session,
    current_user: models.User,
    text_content: str,
    private_to_email: str | None
) -> models.User | None:
    # Private assist target comes from an explicit field or an @email mention.
    target_email = (
        (private_to_email.lower().strip() if private_to_email else None)
        or extract_mentioned_email(text_content)
    )
    if not target_email:
        return None

    if current_user.role not in ["technician", "admin"]:
        raise HTTPException(status_code=403, detail="Only technicians/admins can send private assistance messages")

    recipient = (
        db.query(models.User)
        .filter(
            models.User.email == target_email,
            models.User.role.in_(["technician", "admin"])
        )
        .first()
    )
    if not recipient:
        raise HTTPException(status_code=404, detail="Private recipient must be an existing technician/admin email")
    if recipient.id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot send private message to yourself")
    return recipient


def _save_message_attachment(ticket_id: int, file: UploadFile) -> tuple[str, str, str | None, int]:
    # Stores uploads with a generated filename while preserving the display name.
    safe_name = os.path.basename(file.filename or "attachment")
    ext = os.path.splitext(safe_name)[1]
    stored_name = f"{ticket_id}_{uuid.uuid4().hex}{ext}"
    dest_path = os.path.join(UPLOAD_DIR, stored_name)

    content = file.file.read()
    if len(content) > MAX_ATTACHMENT_BYTES:
        raise HTTPException(status_code=400, detail="Attachment exceeds 10MB limit")
    with open(dest_path, "wb") as out:
        out.write(content)

    return safe_name, dest_path, file.content_type, len(content)


def _message_response(message: models.TicketMessage, sender_email: str, recipient: models.User | None) -> dict:
    return {
        "id": message.id,
        "content": message.content,
        "sender_id": message.sender_id,
        "sender_email": sender_email,
        "created_at": message.created_at,
        "is_private": bool(message.is_private),
        "recipient_email": recipient.email if recipient else None,
        "attachment_name": message.attachment_name,
        "attachment_type": message.attachment_type,
        "attachment_size": message.attachment_size
    }


def _post_message(
    db: Session,
    ticket: models.Ticket,
    current_user: models.User,
    text_content: str,
    private_to_email: str | None,
    attachment: UploadFile | None
) -> dict:
    # Shared flow for JSON and multipart message endpoints:
    # resolve privacy, store, notify, build response.
    recipient = _resolve_private_recipient(db, current_user, text_content, private_to_email)
    is_private = recipient is not None

    attachment_name = attachment_path = attachment_type = None
    attachment_size = None
    if attachment is not None:
        attachment_name, attachment_path, attachment_type, attachment_size = (
            _save_message_attachment(ticket.id, attachment)
        )

    new_message = models.TicketMessage(
        content=text_content,
        sender_id=current_user.id,
        ticket_id=ticket.id,
        created_at=utcnow(),
        is_private=is_private,
        recipient_id=recipient.id if recipient else None,
        attachment_name=attachment_name,
        attachment_path=attachment_path,
        attachment_type=attachment_type,
        attachment_size=attachment_size
    )

    db.add(new_message)
    db.commit()
    db.refresh(new_message)

    if is_private:
        create_notification(
            db,
            user_id=recipient.id,
            type="message",
            content=f"Private assist message on ticket #{ticket.id}: {ticket.title}",
            ticket_id=ticket.id
        )
        db.commit()
    elif notify_ticket_participants(
        db,
        ticket,
        actor_id=current_user.id,
        type="message",
        content=f"New message on ticket #{ticket.id}: {ticket.title}"
    ):
        db.commit()

    return _message_response(new_message, current_user.email, recipient)


@router.get("/tickets/{ticket_id}/messages", response_model=list[schemas.MessageResponse])
def get_ticket_messages(
    ticket_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    ticket = _get_accessible_ticket(db, ticket_id, current_user)

    query = db.query(models.TicketMessage).filter(models.TicketMessage.ticket_id == ticket.id)
    if current_user.role != "admin":
        # Non-admin users only receive public messages plus private messages they participate in.
        query = query.filter(
            or_(
                models.TicketMessage.is_private == False,
                models.TicketMessage.sender_id == current_user.id,
                models.TicketMessage.recipient_id == current_user.id
            )
        )

    messages = query.order_by(models.TicketMessage.id.asc()).all()
    return [
        _message_response(msg, msg.sender.email, msg.recipient)
        for msg in messages
    ]


@router.post("/tickets/{ticket_id}/messages", response_model=schemas.MessageResponse)
def add_ticket_message(
    ticket_id: int,
    message: schemas.MessageCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    ticket = _get_accessible_ticket(db, ticket_id, current_user)

    text_content = (message.content or "").strip()
    if not text_content:
        raise HTTPException(status_code=400, detail="Message content is required")

    return _post_message(db, ticket, current_user, text_content, message.private_to_email, None)


@router.post("/tickets/{ticket_id}/messages/upload", response_model=schemas.MessageResponse)
def add_ticket_message_with_attachment(
    ticket_id: int,
    content: str | None = Form(None),
    private_to_email: str | None = Form(None),
    attachment: UploadFile | None = File(None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    ticket = _get_accessible_ticket(db, ticket_id, current_user)

    text_content = (content or "").strip()
    if not text_content and attachment is None:
        raise HTTPException(status_code=400, detail="Message must include text or attachment")

    return _post_message(db, ticket, current_user, text_content, private_to_email, attachment)


@router.get("/tickets/{ticket_id}/messages/{message_id}/attachment")
def download_message_attachment(
    ticket_id: int,
    message_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    ticket = _get_accessible_ticket(db, ticket_id, current_user)

    message = (
        db.query(models.TicketMessage)
        .filter(
            models.TicketMessage.id == message_id,
            models.TicketMessage.ticket_id == ticket.id
        )
        .first()
    )
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")
    if (
        message.is_private
        and current_user.role != "admin"
        and message.sender_id != current_user.id
        and message.recipient_id != current_user.id
    ):
        # Private attachments follow the same visibility rules as private messages.
        raise HTTPException(status_code=403, detail="Not authorized")
    if not message.attachment_path or not os.path.exists(message.attachment_path):
        raise HTTPException(status_code=404, detail="Attachment not found")

    return FileResponse(
        path=message.attachment_path,
        filename=message.attachment_name or "attachment",
        media_type=message.attachment_type or "application/octet-stream"
    )
