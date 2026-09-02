"""`extract_handles` is pure and side-effect-free (app/links.py) — thorough
unit coverage of its parsing rules belongs here, separate from the API-level
`mentions`-edge tests in tests/test_ideas.py.
"""

from __future__ import annotations

from app.links import extract_handles


def test_single_handle() -> None:
    assert extract_handles("see [[#183]] for the bridge idea") == {183}


def test_multiple_distinct_handles() -> None:
    assert extract_handles("combines [[#1]] and [[#42]]") == {1, 42}


def test_duplicate_handles_collapse_to_one() -> None:
    assert extract_handles("[[#5]] again, still [[#5]]") == {5}


def test_no_handles_in_plain_text() -> None:
    assert extract_handles("just a normal note, nothing here") == set()


def test_empty_body() -> None:
    assert extract_handles("") == set()


def test_handle_zero_parses_but_is_never_a_real_idea() -> None:
    # Syntactically valid; the caller (app/repositories/ideas.py) is the one
    # that knows handle 0 can never exist, since minting starts at 1.
    assert extract_handles("[[#0]]") == {0}


def test_bare_hash_with_no_digits_is_not_a_link() -> None:
    assert extract_handles("[[#]]") == set()


def test_unterminated_brackets_are_not_a_link() -> None:
    assert extract_handles("[[#12") == set()
    assert extract_handles("[[#12]") == set()


def test_missing_open_brackets_are_not_a_link() -> None:
    assert extract_handles("#12]]") == set()


def test_missing_hash_is_not_a_link() -> None:
    assert extract_handles("[[12]]") == set()


def test_nested_brackets_resolve_the_innermost_well_formed_span() -> None:
    assert extract_handles("[[#1[[#2]]]]") == {2}


def test_huge_number_past_a_postgres_integer_is_dropped() -> None:
    assert extract_handles("[[#99999999999999999999999999]]") == set()
    assert extract_handles("[[#2147483648]]") == set()  # one past the max


def test_number_at_the_postgres_integer_max_is_kept() -> None:
    assert extract_handles("[[#2147483647]]") == {2147483647}


def test_leading_zeros_parse_as_the_plain_integer() -> None:
    assert extract_handles("[[#007]]") == {7}


def test_multiple_links_across_lines() -> None:
    body = "para one mentions [[#1]]\n\npara two mentions [[#2]] and [[#3]]"
    assert extract_handles(body) == {1, 2, 3}
