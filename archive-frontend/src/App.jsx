import React, { useState, useRef, useEffect } from 'react';
import { Search, MessageSquare, BookOpen, Loader, FileText, Info, Image, X, ChevronRight } from 'lucide-react';

// --- Components ---

// Displays the IIIF Document in an iframe
const IIIFViewer = ({ url, isOpen, onClose }) => {
  if (!isOpen || !url) return null;

  return (
    <div className="mt-4 h-[600px] w-full rounded-2xl shadow-inner overflow-hidden bg-gray-900 border-4 border-gray-800 flex flex-col relative animate-in fade-in slide-in-from-top duration-500">
      <div className="bg-gray-800 text-white px-4 py-2 text-xs font-mono flex items-center justify-between">
        <div className="flex items-center">
          <Image className="w-3 h-3 mr-2 text-blue-400" />
          <span>IIIF UNIVERSAL VIEWER</span>
        </div>
        <button
          onClick={onClose}
          className="hover:bg-red-500 p-1 rounded transition-colors"
          title="Hide Map/Document"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      <iframe
        src={url}
        title="IIIF Document Viewer"
        width="100%"
        height="100%"
        allowFullScreen
        frameBorder="0"
        style={{ backgroundColor: '#1a1a1a' }}
      />
    </div>
  );
};

// Displays the full text/transcription of the document
const FullTextViewer = ({ document, onOpenIiif }) => {
  if (!document) return null;

  return (
    <div className="mt-6 w-full bg-white rounded-[2rem] shadow-xl border border-gray-100 flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-500">
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-8 py-5 border-b border-blue-100 flex items-center justify-between">
        <div className="flex items-center">
          <div className="bg-blue-600 p-2 rounded-lg mr-4">
            <FileText className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-black text-blue-900 text-sm uppercase tracking-widest">Document Transcription</h3>
            <p className="text-[10px] text-blue-600 font-bold opacity-70">ARCHIVAL RECORD: {document.id}</p>
          </div>
        </div>
        <button
          onClick={() => onOpenIiif(document.viewer_url)}
          className="flex items-center bg-white text-blue-600 border border-blue-200 px-4 py-2 rounded-xl text-xs font-bold hover:bg-blue-600 hover:text-white transition-all shadow-sm active:scale-95"
        >
          <Image className="w-4 h-4 mr-2" />
          VIEW ORIGINAL SCAN
        </button>
      </div>
      <div className="p-10 overflow-y-auto max-h-[800px] prose prose-slate">
        <div className="mb-8 pb-6 border-b border-gray-100">
          <h2 className="text-3xl font-serif font-black text-slate-900 leading-tight mb-4">
            {document.title}
          </h2>
          <div className="flex flex-wrap gap-4 text-xs font-bold text-slate-400">
            <div className="flex items-center bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
              <span className="text-slate-300 mr-2 uppercase">Created</span>
              {document.date_created}
            </div>
            <div className="flex items-center bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
              <span className="text-slate-300 mr-2 uppercase">Author</span>
              {document.creator}
            </div>
            <div className="flex items-center bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
              <span className="text-slate-300 mr-2 uppercase">Collection</span>
              {document.collection}
            </div>
          </div>
        </div>

        <div className="font-serif text-slate-800 text-xl leading-relaxed whitespace-pre-wrap selection:bg-yellow-100">
          {document.full_text || document.excerpt}
        </div>
      </div>
    </div>
  );
};

// Lists the documents returned by the search
const DocumentSidebar = ({ documents, selectedDocId, onSelectDoc, onOpenIiif }) => {
  if (!documents || documents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-slate-400 bg-slate-50/50 rounded-3xl border border-dashed border-slate-200">
        <BookOpen className="w-8 h-8 mb-3 opacity-20" />
        <p className="text-xs font-bold uppercase tracking-wider text-center">No Records Found</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center">
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse mr-2"></div>
          <h3 className="text-xs font-black text-slate-900 uppercase tracking-[0.2em]">Source Records ({documents.length})</h3>
        </div>
      </div>
      {documents.map((doc) => (
        <div
          key={doc.id}
          className={`group flex items-start gap-3 p-4 rounded-2xl cursor-pointer transition-all duration-300 border ${doc.id === selectedDocId
            ? 'bg-white border-blue-500 shadow-xl shadow-blue-500/10 scale-[1.02]'
            : 'bg-white/50 border-transparent hover:bg-white hover:border-slate-200 hover:shadow-md'
            }`}
          onClick={() => onSelectDoc(doc)}
        >
          <div className={`mt-1 flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${doc.id === selectedDocId ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-500'
            }`}>
            <FileText className="w-4 h-4" />
          </div>
          <div className="flex-grow min-w-0">
            <h4 className={`font-bold text-xs mb-1 truncate ${doc.id === selectedDocId ? 'text-blue-600' : 'text-slate-700'}`}>
              {doc.title}
            </h4>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-slate-400">{doc.date_created}</span>
              <span className="text-[10px] font-black text-slate-300 bg-slate-50 px-1 rounded">IISG</span>

              {/* Special IIIF Button directly on document element */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectDoc(doc);
                  onOpenIiif(doc.viewer_url);
                }}
                className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity p-1.5 bg-blue-50 text-blue-600 rounded-md hover:bg-blue-600 hover:text-white"
                title="View Original Map/Scan"
              >
                <Image className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

// --- Main App ---

export default function App() {
  const [query, setQuery] = useState('');
  const [llmResponse, setLlmResponse] = useState('');
  const [documents, setDocuments] = useState([]);
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // IIIF Viewer State
  const [iiifState, setIiifState] = useState({ isOpen: false, url: '' });

  const metadataMarker = '$$DOCS_METADATA$$';
  const llmRef = useRef(null);

  const openIiif = (url) => {
    setIiifState({ isOpen: true, url });
  };

  const handleAsk = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLlmResponse('');
    setDocuments([]);
    setSelectedDocument(null);
    setIiifState({ isOpen: false, url: '' });
    setIsLoading(true);
    setError(null);

    try {
      const apiUrl = process.env.REACT_APP_API_URL || "http://localhost:8000";
      const response = await fetch(`${apiUrl}/mcp/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`HTTP Error ${response.status}: ${errText.substring(0, 200)}...`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulatedText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulatedText += decoder.decode(value, { stream: true });
        const metaIndex = accumulatedText.indexOf(metadataMarker);

        if (metaIndex !== -1) {
          const textPart = accumulatedText.substring(0, metaIndex);
          const metadataJsonString = accumulatedText.substring(metaIndex + metadataMarker.length);
          setLlmResponse(textPart);
          try {
            const parsedDocuments = JSON.parse(metadataJsonString);
            setDocuments(parsedDocuments);
          } catch (jsonError) {
            console.error("Error parsing document metadata:", jsonError);
            setError("Error processing document metadata.");
          }
          break;
        }
        setLlmResponse(accumulatedText);
      }
    } catch (err) {
      console.error("Fetch Error:", err);
      setError(`An error occurred: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center p-4 sm:p-10 font-sans selection:bg-blue-100">
      <div className="max-w-[1400px] w-full">
        {/* Header & Search */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="bg-blue-600 w-3 h-3 rounded-full shadow-[0_0_15px_rgba(37,99,235,0.4)]"></div>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]"></span>
            </div>
            <h1 className="text-4xl font-black text-slate-900 tracking-tight flex items-baseline gap-2">
              <span className="text-blue-600"></span>
            </h1>
          </div>

          <form onSubmit={handleAsk} className="flex-grow max-w-2xl relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-blue-600/20 to-indigo-600/20 rounded-2xl blur-lg transition duration-1000 group-hover:duration-200"></div>
            <div className="relative flex bg-white p-1.5 rounded-2xl shadow-xl border border-white/50">
              <input
                type="text"
                placeholder="Search the historical archives..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                disabled={isLoading}
                className="flex-grow bg-transparent border-none px-5 py-3 focus:ring-0 text-slate-700 font-bold placeholder:text-slate-300 placeholder:font-medium"
              />
              <button
                type="submit"
                disabled={isLoading}
                className="bg-slate-900 text-white px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-blue-600 transition-all active:scale-95 disabled:opacity-50 flex items-center"
              >
                {isLoading ? <Loader className="w-4 h-4 animate-spin mr-2" /> : <Search className="w-4 h-4 mr-2" />}
                Execute
              </button>
            </div>
          </form>
        </div>

        {/* Workspace Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">

          {/* Sidebar: Document Results (3 cols) - ALWAYS VISIBLE */}
          <div className="lg:col-span-3 order-2 lg:order-1">
            <DocumentSidebar
              documents={documents}
              selectedDocId={selectedDocument?.id}
              onSelectDoc={setSelectedDocument}
              onOpenIiif={openIiif}
            />
          </div>

          {/* Main Content Area (9 cols) */}
          <div className="lg:col-span-9 order-1 lg:order-2 space-y-8">

            {/* 1. AI Assistant Response (Main View) - ALWAYS VISIBLE */}
            <div className={`bg-white rounded-[2.5rem] p-10 shadow-2xl transition-all duration-700 border border-white ${llmResponse ? 'scale-100 opacity-100' : 'scale-95 opacity-50'}`}>
              <div className="flex items-center gap-4 mb-8">
                <div className="bg-slate-900 w-12 h-12 rounded-2xl flex items-center justify-center shadow-xl">
                  <MessageSquare className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-900">Analysis Summary</h2>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">AI REASONING ENGINE ACTIVE</p>
                </div>
                {isLoading && (
                  <div className="ml-auto bg-blue-50 text-blue-600 text-[10px] font-black px-3 py-1.5 rounded-full animate-pulse uppercase tracking-wider border border-blue-100">
                    Synthesizing Records...
                  </div>
                )}
              </div>

              {error ? (
                <div className="p-6 bg-red-50 text-red-600 border border-red-100 rounded-3xl font-bold flex items-start gap-4">
                  <X className="w-6 h-6 flex-shrink-0" />
                  {error}
                </div>
              ) : (
                <div className="text-slate-700 text-xl leading-relaxed whitespace-pre-wrap font-medium">
                  {llmResponse || <span className="text-slate-200 italic">Analytical engine awaiting archival input...</span>}
                </div>
              )}
            </div>

            {/* 2. Toggleable IIIF Viewer (Conditional) */}
            <IIIFViewer
              url={iiifState.url}
              isOpen={iiifState.isOpen}
              onClose={() => setIiifState({ ...iiifState, isOpen: false })}
            />

            {/* 3. Document Transcription (Visible only on select) */}
            <FullTextViewer document={selectedDocument} onOpenIiif={openIiif} />

          </div>
        </div>
      </div>
      <footer className="mt-20 py-10 border-t border-slate-200 w-full text-center">
        <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.5em]">Global Social History Data Project • IIIF Federated Library</p>
      </footer>
    </div>
  );
}