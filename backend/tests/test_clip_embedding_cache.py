import clip_classifier


def reset_label_embedding_cache() -> None:
    clip_classifier._label_embeddings = None


def test_label_embedding_cache_key_changes_with_prompt_text(monkeypatch) -> None:
    original_key = clip_classifier.get_label_embedding_cache_key()
    changed_prompts = {
        **clip_classifier.CATEGORY_PROMPTS,
        "dress": f"{clip_classifier.CATEGORY_PROMPTS['dress']} in a store",
    }

    monkeypatch.setattr(clip_classifier, "CATEGORY_PROMPTS", changed_prompts)

    assert clip_classifier.get_label_embedding_cache_key() != original_key


def test_get_label_embeddings_uses_r2_cache(monkeypatch) -> None:
    reset_label_embedding_cache()
    cached_embeddings = {
        "category": {
            label: [float(index)]
            for index, label in enumerate(clip_classifier.CATEGORY_VALUES)
        },
        "color": {
            label: [float(index)]
            for index, label in enumerate(clip_classifier.COLOR_VALUES)
        },
    }

    monkeypatch.setattr(
        clip_classifier,
        "download_json_object",
        lambda _key: cached_embeddings,
    )

    def fail_replicate_call() -> None:
        raise AssertionError("Replicate should not be called on an R2 cache hit.")

    monkeypatch.setattr(clip_classifier, "get_replicate_token", fail_replicate_call)

    assert clip_classifier.get_label_embeddings() == cached_embeddings


def test_get_label_embeddings_populates_r2_on_cache_miss(monkeypatch) -> None:
    reset_label_embedding_cache()
    uploaded_payloads = []

    monkeypatch.setattr(clip_classifier, "download_json_object", lambda _key: None)
    monkeypatch.setattr(clip_classifier, "get_replicate_token", lambda: "token")
    monkeypatch.setattr(
        clip_classifier,
        "create_replicate_prediction",
        lambda _token, payload: [float(len(next(iter(payload.values()))))],
    )
    monkeypatch.setattr(
        clip_classifier,
        "upload_json_object",
        lambda _key, data: uploaded_payloads.append(data),
    )

    label_embeddings = clip_classifier.get_label_embeddings()

    assert uploaded_payloads == [label_embeddings]
    assert set(label_embeddings) == {"category", "color"}


def test_get_label_embeddings_falls_back_when_r2_read_fails(monkeypatch) -> None:
    reset_label_embedding_cache()

    def fail_download(_key):
        raise clip_classifier.ApiError(
            status_code=500,
            code="internal_error",
            message="R2 unavailable.",
        )

    monkeypatch.setattr(clip_classifier, "download_json_object", fail_download)
    monkeypatch.setattr(clip_classifier, "get_replicate_token", lambda: "token")
    monkeypatch.setattr(
        clip_classifier,
        "create_replicate_prediction",
        lambda _token, payload: [float(len(next(iter(payload.values()))))],
    )
    monkeypatch.setattr(clip_classifier, "upload_json_object", lambda _key, _data: None)

    label_embeddings = clip_classifier.get_label_embeddings()

    assert set(label_embeddings["category"]) == set(clip_classifier.CATEGORY_VALUES)
    assert set(label_embeddings["color"]) == set(clip_classifier.COLOR_VALUES)
