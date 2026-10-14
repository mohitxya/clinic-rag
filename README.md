# Clinic RAG

An intelligent clinical retrieval and assistant platform for neurotology and vertigo patient records (Dr. Amol Acharya ENT Clinic).

## What It Does

- **Hybrid RAG Retrieval**: Combines rule-based query routing, structured filtering (diagnosis tags, age, gender), BM25 keyword search, and dense vector embeddings (ChromaDB).
- **Clinical AI Assistant**: Synthesizes clinical impressions, test findings (VNG/audiometry), and treatment history using Google Gemini with citation attribution.
- **Analytics Dashboard**: Tracks patient cohort distributions across conditions (BPPV, Vestibular Migraine, Ménière's Disease, PPPD), age brackets, and genders.
- **Patient Directory**: Interactive record browser with full-text search, filter pills, and comprehensive clinical case views.

## How to Run

1. **Configure Environment**
   Create a `.env` file in the project root with your Gemini API key:
   ```env
   GEMINI_API_KEY=your_api_key_here
   ```

2. **Install Dependencies**
   - Python backend:
     ```bash
     pip install -r requirements.txt
     ```
   - Next.js frontend:
     ```bash
     cd frontend && npm install && cd ..
     ```

3. **Start the Platform**
   Run the unified launcher (boots FastAPI backend on port `8000`, Next.js frontend on port `3000`, and opens your browser):
   ```bash
   python start.py
   ```

   *Alternatively, run services separately:*
   - Backend: `uvicorn app.main:app --reload --port 8000`
   - Frontend: `cd frontend && npm run dev`
