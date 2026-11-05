
import torch
import torch.nn as nn
import json
import random
from pathlib import Path
from fastapi import APIRouter,UploadFile, File, HTTPException
import torch
import torch.nn.functional as F
from pydantic import BaseModel, Field

class TinyChatModel(nn.Module):
    def __init__(
        self,
        vocab_size: int,
        embedding_dim: int = 64,
        hidden_dim: int = 128
    ):
        super().__init__()

        self.embedding = nn.Embedding(
            vocab_size,
            embedding_dim
        )

        self.gru = nn.GRU(
            embedding_dim,
            hidden_dim,
            batch_first=True
        )

        self.output = nn.Linear(
            hidden_dim,
            vocab_size
        )

    def forward(self, input_ids):
        embedded = self.embedding(input_ids)
        hidden, _ = self.gru(embedded)
        logits = self.output(hidden)

        return logits

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "modeldata"
MODEL_DIR = BASE_DIR / "savedmodel"

DATA_DIR.mkdir(exist_ok=True)
MODEL_DIR.mkdir(exist_ok=True)

CORPUS_FILE = DATA_DIR / "corpus.txt"
CHECKPOINT_FILE = MODEL_DIR / "model.pt"

DEVICE = torch.device("cpu")
SEQ_LEN = 64

class TrainRequest(BaseModel):
    training_text: str = Field(
        ...,
        min_length=65,
        description="Text used to train the character-level model"
    )
    epochs: int = Field(default=30, ge=1, le=500)

class ChatRequest(BaseModel):
    question: str = Field(..., min_length=1, max_length=2000)
    max_new_chars: int = Field(default=200, ge=1, le=1000)
    temperature: float = Field(default=0.8, gt=0, le=2.0)

# Reserve ID 0 for characters not seen during training.
UNK = "<UNK>"

def read_corpus():
    if not CORPUS_FILE.exists():
        return ""

    return CORPUS_FILE.read_text(encoding="utf-8")


def build_vocab(text):
    characters = sorted(set(text))

    vocab = [UNK] + characters
    char_to_id = {
        char: index for index, char in enumerate(vocab)
    }

    return vocab, char_to_id


def encode(text, char_to_id):
    return [
        char_to_id.get(char, 0)
        for char in text
    ]


def decode(ids, vocab):
    return "".join(
        vocab[index]
        for index in ids
        if 0 <= index < len(vocab) and index != 0
    )

def train_model(text, epochs=100):
    if len(text) <= SEQ_LEN:
        raise ValueError(
            f"Training text must contain at least {SEQ_LEN + 1} characters."
        )

    vocab, char_to_id = build_vocab(text)

    ids = torch.tensor(
        encode(text, char_to_id),
        dtype=torch.long,
        device=DEVICE
    )

    model = TinyChatModel(
        vocab_size=len(vocab),
        embedding_dim=64,
        hidden_dim=128
    ).to(DEVICE)

    optimizer = torch.optim.Adam(
        model.parameters(),
        lr=0.001
    )

    loss_fn = nn.CrossEntropyLoss()

    max_start = len(ids) - SEQ_LEN - 1
    batch_size = min(32, max(1, max_start + 1))

    # Perform multiple optimizer updates per epoch.
    steps_per_epoch = max(
        1,
        min(200, len(ids) // SEQ_LEN)
    )

    losses = []

    model.train()

    for epoch in range(epochs):
        epoch_loss = 0.0

        for _ in range(steps_per_epoch):
            starts = torch.randint(
                0,
                max_start + 1,
                (batch_size,)
            ).tolist()

            x = torch.stack([
                ids[s:s + SEQ_LEN] for s in starts
            ])

            y = torch.stack([
                ids[s + 1:s + SEQ_LEN + 1]
                for s in starts
            ])

            optimizer.zero_grad()

            logits = model(x)

            loss = loss_fn(
                logits.reshape(-1, len(vocab)),
                y.reshape(-1)
            )

            loss.backward()

            torch.nn.utils.clip_grad_norm_(
                model.parameters(), 1.0
            )

            optimizer.step()
            epoch_loss += loss.item()

        avg_loss = epoch_loss / steps_per_epoch
        losses.append(avg_loss)

    model.eval()

    torch.save({
        "model_state": model.state_dict(),
        "vocab": vocab,
        "embedding_dim": 64,
        "hidden_dim": 128,
        "corpus_length": len(text)
    }, CHECKPOINT_FILE)

    return {
        "epochs": epochs,
        "steps_per_epoch": steps_per_epoch,
        "final_loss": round(losses[-1], 4),
        "vocabulary_size": len(vocab),
        "training_characters": len(text)
    }


def load_model():
    if not CHECKPOINT_FILE.exists():
        return None, None

    checkpoint = torch.load(
        CHECKPOINT_FILE,
        map_location=DEVICE,
        weights_only=True
    )

    vocab = checkpoint["vocab"]

    model = TinyChatModel(
        vocab_size=len(vocab),
        embedding_dim=checkpoint["embedding_dim"],
        hidden_dim=checkpoint["hidden_dim"]
    ).to(DEVICE)

    model.load_state_dict(checkpoint["model_state"])
    model.eval()

    return model, vocab

def generate_text(prompt, max_new_chars=200, temperature=0.7):
    model, vocab = load_model()

    if model is None:
        raise ValueError(
            "Model is not trained. Call POST /train first."
        )

    char_to_id = {
        char: index for index, char in enumerate(vocab)
    }

    ids = encode(prompt, char_to_id)

    if not ids:
        ids = [0]

    generated = list(ids)
    model.eval()

    for _ in range(max_new_chars):
        context = torch.tensor(
            [generated[-SEQ_LEN:]],
            dtype=torch.long,
            device=DEVICE
        )

        with torch.no_grad():
            logits = model(context)

        next_logits = logits[0, -1].clone()

        next_logits[0] = float("-inf")
        next_logits /= max(temperature, 0.1)

        probabilities = torch.softmax(
            next_logits, dim=-1
        )

        if not torch.isfinite(probabilities).all():
            break

        next_id = torch.multinomial(
            probabilities, num_samples=1
        ).item()

        generated.append(next_id)

        generated_text = decode(generated, vocab)
        new_text = generated_text[len(prompt):]

        if "\nUser:" in new_text:
            new_text = new_text.split("\nUser:", 1)[0]
            return new_text.strip()

    return decode(generated[len(ids):], vocab).strip()

mdlrouter = APIRouter(
    prefix="/NewModel",
    tags=["NewModel"],
)
@mdlrouter.get("/model/status")
def model_status():
    return {
        "trained": CHECKPOINT_FILE.exists(),
        "training_characters": len(read_corpus()),
        "model_file_exists": CHECKPOINT_FILE.exists()
    }


@mdlrouter.post("/train")
def train(request: TrainRequest):
    try:
        # Save all training text so future training can use it too.
        previous_text = read_corpus()
        combined_text = previous_text + "\n" + request.training_text

        # Train before committing the new corpus.
        result = train_model(
            combined_text,
            epochs=request.epochs
        )

        CORPUS_FILE.write_text(
            combined_text,
            encoding="utf-8"
        )

        return {
            "message": "Model training completed",
            "training": result
        }

    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc)
        ) from exc

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Training failed: {str(exc)}"
        ) from exc


@mdlrouter.post("/chat")
def chat(request: ChatRequest):
    try:
        prompt = (
            f"\nUser: {request.question}\n"
            "Assistant:"
        )

        answer = generate_text(
            prompt=f"\nUser: {request.question}\nAssistant:",
            max_new_chars=request.max_new_chars,
            temperature=request.temperature
        )

        return {
            "question": request.question,
            "answer": answer.strip(),
            "model": "TinyChatModel"
        }

    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc)
        ) from exc

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Chat generation failed: {str(exc)}"
        ) from exc