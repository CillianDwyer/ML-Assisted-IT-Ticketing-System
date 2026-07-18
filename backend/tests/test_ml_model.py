# Tests for the classifier's input gate and confidence threshold.

from ml.ml_model import _has_enough_signal, predict_category


def test_too_short_input_rejected():
    assert _has_enough_signal("help") is False
    assert _has_enough_signal("no no no") is False  # not enough unique tokens... (3 words, 1 unique)


def test_punctuation_only_rejected():
    assert _has_enough_signal("??? !!! ...") is False


def test_reasonable_description_accepted():
    assert _has_enough_signal("My laptop will not connect to the office VPN") is True


def test_gibberish_is_uncategorized():
    assert predict_category("asdf qwer zxcv uiop") == "Uncategorized"


def test_empty_is_uncategorized():
    assert predict_category("") == "Uncategorized"


def test_clear_it_issue_is_classified():
    result = predict_category(
        "I forgot my password and need it reset so I can log in to my account"
    )
    assert result != "Uncategorized"
