import os

def test_distilcamembert():
    """Load DistilCamemBERT NER pipeline using PyTorch only."""
    os.environ["TRANSFORMERS_NO_TF"] = "1"
    os.environ["TF_CPP_MIN_LOG_LEVEL"] = "3"
    os.environ["USE_TF"] = "0"
    os.environ["USE_TORCH"] = "1"

    try:
        from transformers import AutoTokenizer, pipeline
    except ImportError as e:
        if "tensorflow" in str(e).lower():
            import transformers

            transformers.utils.import_utils.is_tf_available = lambda: False
            from transformers import AutoTokenizer, pipeline
        else:
            raise

    tokenizer = AutoTokenizer.from_pretrained(
        "allocation-de-parole/camembert-base-ner",
        use_fast=True,
        local_files_only=False
    )
    ner = pipeline(
        "ner",
        model="allocation-de-parole/camembert-base-ner",
        tokenizer=tokenizer,
        aggregation_strategy="simple",
        device=-1,
        framework="pt",
        return_all_scores=False
    )
    result = ner("Jean Dupont travaille chez OpenAI.")
    print("✅ DistilCamemBERT fonctionne:", result)
    return True

if __name__ == "__main__":
    test_distilcamembert()
