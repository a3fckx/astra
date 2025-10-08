from pymongo.mongo_client import MongoClient
from pymongo.server_api import ServerApi
from dotenv import load_dotenv
import os

load_dotenv()  # Load .env

# URI from env
username = os.getenv("MONGODB_USERNAME")
password = os.getenv("MONGODB_PASSWORD")
cluster = os.getenv("MONGODB_CLUSTER", "astra.ethgite")  # Default from your URI

if not username or not password:
    print("Error: Fill MONGODB_USERNAME and MONGODB_PASSWORD in .env")
    exit(1)

uri = f"mongodb+srv://{username}:{password}@{cluster}.mongodb.net/?retryWrites=true&w=majority&appName=astra"

# Create a new client and connect to the server
client = MongoClient(uri, server_api=ServerApi("1"))

# Send a ping to confirm a successful connection
try:
    client.admin.command("ping")
    print("Pinged your deployment. You successfully connected to MongoDB!")
    # List dbs for test
    print("Databases:", client.list_database_names())
except Exception as e:
    print(e)
