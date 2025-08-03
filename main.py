# main.py

import os
import json
import hashlib
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Dict, Optional
from fastapi import FastAPI, Request, Form, HTTPException, BackgroundTasks
from fastapi.responses import HTMLResponse, RedirectResponse, JSONResponse
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles
import asyncio

# Configuration
STORAGE_DIR = "storage"
DOCUMENTS_DIR = os.path.join(STORAGE_DIR, "documents")
BACKUPS_DIR = os.path.join(STORAGE_DIR, "backups")
METADATA_FILE = os.path.join(STORAGE_DIR, "metadata.json")
MAX_BACKUPS = 10

# Create directories if they don't exist
for directory in [STORAGE_DIR, DOCUMENTS_DIR, BACKUPS_DIR]:
    os.makedirs(directory, exist_ok=True)

app = FastAPI(title="Advanced Text Editor", description="A web-based text editor with multiple documents and version control")
app.mount("/Templates", StaticFiles(directory="Templates"), name="static")
templates = Jinja2Templates(directory="templates")
app.mount("/Vendor", StaticFiles(directory="Vendor"), name="static")
vendor = Jinja2Templates(directory="vendor")

class DocumentManager:
    def __init__(self):
        self.load_metadata()
    
    def load_metadata(self):
        """Load document metadata from file."""
        if os.path.exists(METADATA_FILE):
            try:
                with open(METADATA_FILE, "r", encoding="utf-8") as f:
                    self.metadata = json.load(f)
            except (json.JSONDecodeError, IOError):
                self.metadata = {}
        else:
            self.metadata = {}
    
    def save_metadata(self):
        """Save document metadata to file."""
        with open(METADATA_FILE, "w", encoding="utf-8") as f:
            json.dump(self.metadata, f, indent=2, default=str)
    
    def get_document_path(self, doc_id: str) -> str:
        """Get the file path for a document."""
        safe_id = "".join(c for c in doc_id if c.isalnum() or c in ('-', '_', '.'))
        return os.path.join(DOCUMENTS_DIR, f"{safe_id}.txt")
    
    def get_backup_path(self, doc_id: str, timestamp: str) -> str:
        """Get the backup file path for a document."""
        safe_id = "".join(c for c in doc_id if c.isalnum() or c in ('-', '_', '.'))
        return os.path.join(BACKUPS_DIR, f"{safe_id}_{timestamp}.txt")
    
    def create_document(self, title: str, content: str = "") -> str:
        """Create a new document and return its ID."""
        doc_id = self.generate_doc_id(title)
        now = datetime.now(timezone.utc)
        
        # Save document content
        doc_path = self.get_document_path(doc_id)
        with open(doc_path, "w", encoding="utf-8") as f:
            f.write(content)
        
        # Update metadata
        self.metadata[doc_id] = {
            "title": title,
            "created": now.isoformat(),
            "modified": now.isoformat(),
            "size": len(content),
            "lines": len(content.split('\n')) if content else 1,
            "checksum": self.calculate_checksum(content)
        }
        self.save_metadata()
        return doc_id
    
    def generate_doc_id(self, title: str) -> str:
        """Generate a unique document ID from title."""
        base_id = "".join(c.lower() for c in title if c.isalnum() or c == ' ').replace(' ', '-')
        if not base_id:
            base_id = "untitled"
        
        # Ensure uniqueness
        counter = 1
        doc_id = base_id
        while doc_id in self.metadata:
            doc_id = f"{base_id}-{counter}"
            counter += 1
        
        return doc_id
    
    def calculate_checksum(self, content: str) -> str:
        """Calculate MD5 checksum of content."""
        return hashlib.md5(content.encode('utf-8')).hexdigest()
    
    def get_document(self, doc_id: str) -> Dict:
        """Get document content and metadata."""
        if doc_id not in self.metadata:
            raise HTTPException(status_code=404, detail="Document not found")
        
        doc_path = self.get_document_path(doc_id)
        if not os.path.exists(doc_path):
            raise HTTPException(status_code=404, detail="Document file not found")
        
        with open(doc_path, "r", encoding="utf-8") as f:
            content = f.read()
        
        return {
            "id": doc_id,
            "content": content,
            "metadata": self.metadata[doc_id]
        }
    
    def save_document(self, doc_id: str, content: str, create_backup: bool = True):
        """Save document content with optional backup."""
        if doc_id not in self.metadata:
            raise HTTPException(status_code=404, detail="Document not found")
        
        doc_path = self.get_document_path(doc_id)
        
        # Create backup if content has changed
        if create_backup and os.path.exists(doc_path):
            with open(doc_path, "r", encoding="utf-8") as f:
                old_content = f.read()
            
            if self.calculate_checksum(old_content) != self.calculate_checksum(content):
                self.create_backup(doc_id, old_content)
        
        # Save new content
        with open(doc_path, "w", encoding="utf-8") as f:
            f.write(content)
        
        # Update metadata
        now = datetime.now(timezone.utc)
        self.metadata[doc_id].update({
            "modified": now.isoformat(),
            "size": len(content),
            "lines": len(content.split('\n')) if content else 1,
            "checksum": self.calculate_checksum(content)
        })
        self.save_metadata()
    
    def create_backup(self, doc_id: str, content: str):
        """Create a backup of the document."""
        timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
        backup_path = self.get_backup_path(doc_id, timestamp)
        
        with open(backup_path, "w", encoding="utf-8") as f:
            f.write(content)
        
        # Clean old backups
        self.cleanup_old_backups(doc_id)
    
    def cleanup_old_backups(self, doc_id: str):
        """Remove old backups, keeping only the most recent ones."""
        safe_id = "".join(c for c in doc_id if c.isalnum() or c in ('-', '_', '.'))
        
        backup_files = []
        for file in os.listdir(BACKUPS_DIR):
            if file.startswith(f"{safe_id}_") and file.endswith(".txt"):
                backup_files.append(os.path.join(BACKUPS_DIR, file))
        
        backup_files.sort(key=os.path.getmtime, reverse=True)
        for old_backup in backup_files[MAX_BACKUPS:]:
            try:
                os.remove(old_backup)
            except OSError:
                pass
    
    def list_documents(self) -> List[Dict]:
        """List all documents with metadata."""
        documents = []
        for doc_id, metadata in self.metadata.items():
            documents.append({
                "id": doc_id,
                "title": metadata["title"],
                "modified": metadata["modified"],
                "size": metadata["size"],
                "lines": metadata["lines"]
            })
        
        documents.sort(key=lambda x: x["modified"], reverse=True)
        return documents

    def list_backups(self, doc_id: str) -> List[Dict]:
        """List all backups for a specific document."""
        if doc_id not in self.metadata:
            raise HTTPException(status_code=404, detail="Document not found")
        
        safe_id = "".join(c for c in doc_id if c.isalnum() or c in ('-', '_', '.'))
        backups = []
        for file in os.listdir(BACKUPS_DIR):
            if file.startswith(f"{safe_id}_") and file.endswith(".txt"):
                timestamp_str = file[len(safe_id)+1:-4]
                try:
                    # Create a datetime object for user-friendly display
                    dt_obj = datetime.strptime(timestamp_str, "%Y%m%d_%H%M%S")
                    backups.append({
                        "timestamp": timestamp_str,
                        "datetime": dt_obj.strftime("%Y-%m-%d %H:%M:%S")
                    })
                except ValueError:
                    continue # Skip files with malformed timestamps
        
        backups.sort(key=lambda x: x["timestamp"], reverse=True)
        return backups

    def restore_backup(self, doc_id: str, timestamp: str):
        """Restore a document from a specific backup."""
        if doc_id not in self.metadata:
            raise HTTPException(status_code=404, detail="Document not found")
        
        backup_path = self.get_backup_path(doc_id, timestamp)
        if not os.path.exists(backup_path):
            raise HTTPException(status_code=404, detail="Backup not found")
        
        with open(backup_path, "r", encoding="utf-8") as f:
            content = f.read()
        
        # Save the content to the main document file.
        # This will also create a new backup of the *current* state before overwriting.
        self.save_document(doc_id, content)

    def delete_document(self, doc_id: str):
        """Delete a document and its backups."""
        if doc_id not in self.metadata:
            raise HTTPException(status_code=404, detail="Document not found")
        
        doc_path = self.get_document_path(doc_id)
        if os.path.exists(doc_path):
            os.remove(doc_path)
        
        safe_id = "".join(c for c in doc_id if c.isalnum() or c in ('-', '_', '.'))
        for file in os.listdir(BACKUPS_DIR):
            if file.startswith(f"{safe_id}_") and file.endswith(".txt"):
                try:
                    os.remove(os.path.join(BACKUPS_DIR, file))
                except OSError:
                    pass
        
        del self.metadata[doc_id]
        self.save_metadata()

doc_manager = DocumentManager()

@app.on_event("startup")
async def startup_event():
    if not doc_manager.list_documents():
        doc_manager.create_document("Welcome Document", 
            "Welcome to the Advanced Text Editor!")

@app.get("/", response_class=HTMLResponse)
async def dashboard(request: Request):
    documents = doc_manager.list_documents()
    return templates.TemplateResponse(
        "dashboard.html", {"request": request, "documents": documents}
    )

@app.get("/editor/{doc_id}", response_class=HTMLResponse)
async def read_editor(request: Request, doc_id: str):
    try:
        document = doc_manager.get_document(doc_id)
        return templates.TemplateResponse(
            "editor.html", {
                "request": request, 
                "document": document,
                "doc_id": doc_id
            }
        )
    except HTTPException:
        return RedirectResponse(url="/", status_code=303)

@app.post("/create")
async def create_document(title: str = Form(...), content: str = Form(default="")):
    doc_id = doc_manager.create_document(title, content)
    return RedirectResponse(url=f"/editor/{doc_id}", status_code=303)

@app.post("/delete/{doc_id}")
async def delete_document(doc_id: str):
    try:
        doc_manager.delete_document(doc_id)
        return JSONResponse({"status": "success"})
    except HTTPException as e:
        return JSONResponse({"status": "error", "message": str(e.detail)}, status_code=e.status_code)

# --- API Endpoints ---

@app.get("/api/documents")
async def api_list_documents():
    return {"documents": doc_manager.list_documents()}

@app.get("/api/document/{doc_id}")
async def api_get_document(doc_id: str):
    try:
        return doc_manager.get_document(doc_id)
    except HTTPException as e:
        return JSONResponse({"error": str(e.detail)}, status_code=e.status_code)

@app.post("/api/save/{doc_id}")
async def api_save_document(doc_id: str, request: Request):
    try:
        data = await request.json()
        content = data.get("content", "")
        doc_manager.save_document(doc_id, content)
        return {"status": "success", "message": "Document saved successfully"}
    except HTTPException as e:
        return JSONResponse({"error": str(e.detail)}, status_code=e.status_code)

@app.get("/api/document/{doc_id}/backups")
async def api_list_backups(doc_id: str):
    """API endpoint to list backups for a document."""
    try:
        backups = doc_manager.list_backups(doc_id)
        return {"backups": backups}
    except HTTPException as e:
        return JSONResponse({"error": str(e.detail)}, status_code=e.status_code)

@app.post("/api/document/{doc_id}/restore/{timestamp}")
async def api_restore_backup(doc_id: str, timestamp: str):
    """API endpoint to restore a document from a backup."""
    try:
        doc_manager.restore_backup(doc_id, timestamp)
        return {"status": "success", "message": "Backup restored successfully"}
    except HTTPException as e:
        return JSONResponse({"error": str(e.detail)}, status_code=e.status_code)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)