#!/usr/bin/env python3
"""
MongoDB connection test with detailed diagnostics

Tests connection to MongoDB Atlas and verifies read/write permissions.
"""

import os
import sys
from urllib.parse import quote_plus

from dotenv import load_dotenv
from pymongo import MongoClient
from pymongo.server_api import ServerApi

# Load .env from parent directory (force override any existing env vars)
load_dotenv(override=True)

# Support full URI or username/password combos
mongodb_uri = os.getenv('MONGODB_URI')
username = os.getenv('MONGODB_USERNAME')
password = os.getenv('MONGODB_PASSWORD')
cluster = os.getenv('MONGODB_CLUSTER', 'astra.ethgite')

print("MongoDB Connection Test")
print("=" * 50)

if mongodb_uri:
    uri = mongodb_uri
    print("Using MONGODB_URI from environment")
    if "@" in mongodb_uri:
        host_segment = mongodb_uri.split("@", 1)[-1]
        print(f"URI host segment: {host_segment}")
else:
    if not username or not password:
        print("❌ Error: Provide either MONGODB_URI or MONGODB_USERNAME/MONGODB_PASSWORD in .env")
        print("\nExamples:")
        print("  MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/?retryWrites=true&w=majority")
        print("  MONGODB_USERNAME=your_username")
        print("  MONGODB_PASSWORD=your_password")
        print("  MONGODB_CLUSTER=astra.ethgite")
        sys.exit(1)

    masked_username = f"{username[:2]}***{username[-1:]}" if len(username) > 3 else "***"
    print(f"Username: {masked_username}")
    print(f"Cluster: {cluster}")
    print(f"Password length: {len(password)} chars")

    username_encoded = quote_plus(username)
    password_encoded = quote_plus(password)
    uri = (
        f"mongodb+srv://{username_encoded}:{password_encoded}@{cluster}.mongodb.net/"
        f"?retryWrites=true&w=majority&appName=astra"
    )

    print("\nConnecting to MongoDB Atlas...")
    print(f"Cluster: {cluster}.mongodb.net")

try:
    # Create client
    client = MongoClient(uri, server_api=ServerApi('1'), serverSelectionTimeoutMS=5000)

    # Test connection
    print("\n1. Testing connection (ping)...")
    client.admin.command('ping')
    print("   ✅ Connection successful!")

    # List databases
    print("\n2. Listing databases...")
    dbs = client.list_database_names()
    print(f"   ✅ Found {len(dbs)} database(s): {', '.join(dbs)}")

    # Test read/write to astra database
    print("\n3. Testing read/write permissions...")
    db = client['astra']
    test_collection = db['connection_test']

    # Try to insert
    result = test_collection.insert_one({"test": "connection", "status": "ok"})
    print(f"   ✅ Write successful! Inserted document ID: {result.inserted_id}")

    # Try to read
    doc = test_collection.find_one({"test": "connection"})
    print(f"   ✅ Read successful! Found document: {doc['status']}")

    # Cleanup
    test_collection.delete_one({"_id": result.inserted_id})
    print("   ✅ Delete successful! Cleaned up test document")

    print("\n" + "=" * 50)
    print("✅ ALL TESTS PASSED")
    print("=" * 50)
    print("\nYour MongoDB setup is working correctly!")
    print("Database 'astra' is ready for use.")

except Exception as e:
    print(f"\n❌ Error: {e}")
    print("\nTroubleshooting:")
    print("1. Verify username/password in .env are correct")
    print("2. Check MongoDB Atlas Network Access (IP whitelist)")
    print("3. Verify user has 'readWrite' role on 'astra' database")
    print("4. Check if password has special characters (should be URL-encoded)")
    print("\nMongoDB Atlas checklist:")
    print("  □ Database Access: User created with username/password")
    print("  □ Network Access: IP 0.0.0.0/0 allowed (or your IP)")
    print("  □ Database: 'astra' database exists")
    print("  □ Permissions: User has 'readWriteAnyDatabase' or 'readWrite@astra'")
    sys.exit(1)
finally:
    if 'client' in locals():
        client.close()
