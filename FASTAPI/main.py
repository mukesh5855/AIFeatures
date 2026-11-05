
from Modules.RagModule import router as RagRouter
from Modules.LangChainModule import lngrouter as LngRouter
from Modules.LangGraphModule import graphrouter as GraphRouter
from Modules.NewModelModule import mdlrouter as MdlRouter
from fastapi import FastAPI, File, HTTPException, UploadFile, APIRouter
from pydantic import BaseModel, Field
from pypdf import PdfReader
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Simple PDF Rest API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def home():
    return {"message": "PDF RAG API is running"}

@app.get("/testbasics")
def test_basics():
    python_learn()
    return {"message": "PDF RAG API is running and basic test passed"}

app.include_router(RagRouter)
app.include_router(LngRouter)
app.include_router(GraphRouter)
app.include_router(MdlRouter)

def python_learn():
    name = "Mukesh"
    age = 30
    salary = 50000.50
    is_employee = True
    print(name)
    print(age,salary,is_employee)
    print(type(name),type(age),type(is_employee))
    a = 5
    b = 10
    print(a == b) 
    print(a > b)
    print(a != b) 
    print(a / b)

    age = 25
    if (age > 25 ):
       print("Eligible for Jon")

    if (age> 25) :
       print("Great")
    elif (age < 25) :
       print ("not great")
    elif (age < 20) :
       print ("too less")
    else :
       print ("not eligible")


def Test():
    print("Hi There")
    items = []
    items.append("Item 1")
    items.append(1)
    items.append(False)
    print(items[0],items[1],items[2])
    for x in items:
       print(x)