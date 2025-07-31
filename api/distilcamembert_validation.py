import os

def test_distilcamembert():
    """Load DistilCamemBERT NER pipeline using PyTorch only."""
    os.environ["TRANSFORMERS_NO_TF"] = "1"
    os.environ["TF_CPP_MIN_LOG_LEVEL"] = "3"
    os.environ["USE_TF"] = "0"
    os.environ["USE_TORCH"] = "1"

    try:
        from transformers import pipeline
    except ImportError as e:
        if "tensorflow" in str(e).lower():
            import transformers

            transformers.utils.import_utils.is_tf_available = lambda: False
            from transformers import pipeline
        else:
            raise

    ner = pipeline(
        "ner",
        model="cmarkea/distilcamembert-base-ner",
        tokenizer="cmarkea/distilcamembert-base-ner",
        device=-1,
    )
    result = ner("Jean Dupont travaille chez OpenAI.")
    print("✅ DistilCamemBERT fonctionne:", result)
    return True

if __name__ == "__main__":
    test_distilcamembert()
