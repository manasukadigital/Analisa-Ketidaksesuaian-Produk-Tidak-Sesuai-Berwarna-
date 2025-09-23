import React, { useState, useMemo } from 'react';
import ReactDOM from 'react-dom/client';
import { GoogleGenAI, Type } from "@google/genai";
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';


// Initialize the Gemini AI model
// NOTE: In a real app, the API key should be handled securely and not exposed in the client-side code.
// We assume `process.env.API_KEY` is replaced by a build tool or environment setup.
const API_KEY = process.env.API_KEY;
const ai = new GoogleGenAI({ apiKey: API_KEY });

const fishboneCategoryGroups = [
  {
    name: "1. Produksi / Operasional (6M klasik)",
    subCategories: [
      "Manusia (Man) → tenaga kerja, keterampilan, motivasi",
      "Mesin (Machine) → kondisi mesin, perawatan, downtime",
      "Metode (Method) → SOP, instruksi kerja, teknik produksi",
      "Material (Material) → bahan baku, kualitas, pemasok",
      "Pengukuran (Measurement) → standar mutu, kalibrasi, KPI produksi",
      "Lingkungan (Mother Nature/Environment) → suhu, kelembapan, kondisi tempat kerja",
    ],
  },
  {
    name: "2. Manajemen Umum",
    subCategories: [
      "Kepemimpinan & Pengambilan Keputusan → arahan, kecepatan keputusan",
      "Kebijakan & Tata Kelola → aturan, regulasi, kepatuhan",
      "Strategi → visi, misi, roadmap tidak jelas",
      "Komunikasi → koordinasi antar divisi",
      "Budaya Organisasi → resistensi terhadap perubahan, budaya kerja",
    ],
  },
  {
    name: "3. Keuangan (Finance & Akuntansi)",
    subCategories: [
      "Penganggaran & Kontrol → alokasi dana, arus kas",
      "Pendapatan & Biaya → penjualan, biaya operasional",
      "Kebijakan & Kepatuhan → pajak, audit, regulasi",
      "Sistem & Alat → software akuntansi, ERP",
      "SDM → kompetensi staf keuangan",
    ],
  },
  {
    name: "4. Sumber Daya Manusia (HRD)",
    subCategories: [
      "Rekrutmen → kesalahan seleksi, gap keterampilan",
      "Pelatihan & Pengembangan → kurangnya program peningkatan skill",
      "Kinerja & Penilaian → penilaian tidak objektif",
      "Kompensasi & Benefit → gaji, tunjangan, insentif",
      "Hubungan Industrial → serikat pekerja, konflik tenaga kerja",
      "Keterlibatan & Budaya Kerja → kepuasan kerja, moral, motivasi",
    ],
  },
  {
    name: "5. Pemasaran & Penjualan",
    subCategories: [
      "Kebutuhan Pelanggan → tren pasar berubah, ekspektasi tidak jelas",
      "Produk & Layanan → kualitas, inovasi, diferensiasi",
      "Harga (Price) → strategi harga tidak kompetitif",
      "Distribusi (Place) → saluran distribusi terbatas",
      "Promosi → iklan, branding, digital marketing",
      "SDM Penjualan (People) → keterampilan tim sales, motivasi",
    ],
  },
  {
    name: "6. Riset & Pengembangan (R&D)",
    subCategories: [
      "Ide & Kreativitas → kurang riset pasar, minim inovasi",
      "Teknologi → alat, software, metode terbatas",
      "Proses → siklus inovasi lambat",
      "Pendanaan → anggaran terbatas",
      "Kolaborasi → kurang kerja sama eksternal (universitas, mitra)",
      "SDM → keterampilan tim riset",
    ],
  },
  {
    name: "7. Teknologi Informasi (IT)",
    subCategories: [
      "Infrastruktur → jaringan, server, hardware",
      "Perangkat Lunak → bug, aplikasi usang",
      "Manajemen Data → keamanan, integritas, backup",
      "Kebijakan & Keamanan → cyber security, kontrol akses",
      "SDM IT → keterampilan staf, kecepatan support",
    ],
  },
  {
    name: "8. Mutu, K3 & Lingkungan",
    subCategories: [
      "Standar Mutu → ISO, SOP mutu",
      "Keselamatan Kerja (K3) → kecelakaan, APD",
      "Lingkungan → limbah, polusi, regulasi lingkungan",
      "Kepatuhan → audit, sertifikasi",
      "Pelatihan & Kesadaran → training mutu & safety",
    ],
  },
  {
    name: "9. Logistik & Rantai Pasok",
    subCategories: [
      "Pemasok (Supplier) → keterlambatan, kualitas rendah",
      "Transportasi → armada, biaya distribusi",
      "Pergudangan → stok menumpuk, sistem FIFO tidak jalan",
      "Aliran Informasi → data supply tidak update",
      "Biaya → ongkos transportasi, gudang, impor",
    ],
  },
  {
    name: "10. Layanan Pelanggan",
    subCategories: [
      "Waktu Tanggap (Response Time) → kecepatan pelayanan",
      "Pengetahuan → keterampilan staf customer service",
      "Alat & Sistem → CRM, ticketing system",
      "Komunikasi → empati, bahasa, follow-up",
      "Kebijakan → retur, garansi, fleksibilitas layanan",
    ],
  },
];


// --- Type Definitions ---
interface FishboneCategory {
  id: number;
  name: string;
  customName: string;
  causes: string[];
}

interface FiveWhyAnalysis {
  id: number;
  initialCause: string;
  whys: string[];
}

type RcaMethod = 'fishbone' | '5why';

interface ContainmentAction {
  id: number;
  rootCauseReference: string;
  action: string;
  pic: string;
  dueDate: string;
  status: 'Belum Mulai' | 'Sedang Dikerjakan' | 'Selesai' | 'Dibatalkan';
}

interface PreventiveAction {
  id: number;
  rootCauseReference: string;
  action: string;
  pic: string;
  reviewer: string;
  dueDate: string;
  priority: 'Rendah' | 'Sedang' | 'Tinggi';
  riskRating: 'Rendah' | 'Sedang' | 'Tinggi';
}


const NewCaseForm = () => {
  // --- State Definitions ---
  const [formData, setFormData] = useState({
    referenceNumber: '',
    date: new Date().toISOString().split('T')[0],
    location: '',
    customerDesign: '',
    salesOrderNumber: '',
    quantity: '',
    severity: 'Medium',
    description: '',
    evidence: null as File | null,
  });

  // RCA State
  const [activeRcaMethod, setActiveRcaMethod] = useState<RcaMethod>('fishbone');
  const [activeFishboneCategories, setActiveFishboneCategories] = useState<FishboneCategory[]>([]);
  const [fiveWhyAnalyses, setFiveWhyAnalyses] = useState<FiveWhyAnalysis[]>([]);
  
  // Action Plan State
  const [containmentActions, setContainmentActions] = useState<ContainmentAction[]>([]);
  const [preventiveActions, setPreventiveActions] = useState<PreventiveAction[]>([]);

  // UI State
  const [aiError, setAiError] = useState('');
  const [enhancingField, setEnhancingField] = useState<string | null>(null);
  const [isAiSuggesting, setIsAiSuggesting] = useState<string | null>(null);


  // --- Handlers for Case Details ---
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFormData(prev => ({ ...prev, evidence: e.target.files[0] }));
    }
  };

  // --- Handlers for RCA ---
  // Fishbone - Category Management
  const addFishboneCategory = () => {
    setActiveFishboneCategories(prev => [
      ...prev,
      { id: Date.now(), name: fishboneCategoryGroups[0].subCategories[0], customName: '', causes: [''] }
    ]);
  };

  const removeFishboneCategory = (categoryId: number) => {
    setActiveFishboneCategories(prev => prev.filter(cat => cat.id !== categoryId));
  };
  
  const handleFishboneCategoryChange = (id: number, field: 'name' | 'customName', value: string) => {
    setActiveFishboneCategories(prev => 
      prev.map(cat => cat.id === id ? { ...cat, [field]: value } : cat)
    );
  };

  // Fishbone - Cause Management
  const handleFishboneCauseChange = (categoryId: number, causeIndex: number, value: string) => {
    setActiveFishboneCategories(prev => prev.map(cat => {
      if (cat.id === categoryId) {
        const newCauses = [...cat.causes];
        newCauses[causeIndex] = value;
        return { ...cat, causes: newCauses };
      }
      return cat;
    }));
  };
  
  const addFishboneCause = (categoryId: number) => {
     setActiveFishboneCategories(prev => prev.map(cat => 
        cat.id === categoryId ? { ...cat, causes: [...cat.causes, ''] } : cat
    ));
  };
  
  const removeFishboneCause = (categoryId: number, causeIndex: number) => {
    setActiveFishboneCategories(prev => prev.map(cat => {
      if (cat.id === categoryId) {
        const newCauses = [...cat.causes];
        newCauses.splice(causeIndex, 1);
        return { ...cat, causes: newCauses };
      }
      return cat;
    }));
  };
  
  // 5 Whys Management
  const addFiveWhyAnalysis = () => {
    setFiveWhyAnalyses(prev => [
      ...prev,
      { id: Date.now(), initialCause: '', whys: [] }
    ]);
  };

  const removeFiveWhyAnalysis = (analysisId: number) => {
    setFiveWhyAnalyses(prev => prev.filter(analysis => analysis.id !== analysisId));
  };

  const handle5WhyInputChange = (analysisId: number, whyIndex: number, value: string) => {
    setFiveWhyAnalyses(prev => prev.map(analysis => {
        if (analysis.id === analysisId) {
            if (whyIndex === -1) { // -1 indicates the initial cause dropdown
                const isFirstSelection = analysis.whys.length === 0 && value;
                const finalWhys = isFirstSelection ? [''] : [];
                return { ...analysis, initialCause: value, whys: finalWhys };
            }
            const newWhys = [...analysis.whys];
            newWhys[whyIndex] = value;
            return { ...analysis, whys: newWhys };
        }
        return analysis;
    }));
  };

  const addFiveWhy = (analysisId: number) => {
      setFiveWhyAnalyses(prev => prev.map(analysis => 
          analysis.id === analysisId ? { ...analysis, whys: [...analysis.whys, ''] } : analysis
      ));
  };

  const removeFiveWhy = (analysisId: number, whyIndex: number) => {
      setFiveWhyAnalyses(prev => prev.map(analysis => {
          if (analysis.id === analysisId) {
              const newWhys = [...analysis.whys];
              newWhys.splice(whyIndex, 1);
              return { ...analysis, whys: newWhys };
          }
          return analysis;
      }));
  };


  // --- Handlers for Action Plan ---
  const addContainmentAction = () => {
    const newAction: ContainmentAction = { id: Date.now(), rootCauseReference: '', action: '', pic: '', dueDate: '', status: 'Belum Mulai' };
    setContainmentActions(prev => [...prev, newAction]);
  };

  const handleContainmentChange = (id: number, field: keyof Omit<ContainmentAction, 'id'>, value: string) => {
    setContainmentActions(prev => prev.map(act => act.id === id ? { ...act, [field]: value } : act));
  };
  
  const removeContainmentAction = (id: number) => {
     setContainmentActions(prev => prev.filter(act => act.id !== id));
  };

  const addPreventiveAction = () => {
      const newAction: PreventiveAction = { id: Date.now(), rootCauseReference: '', action: '', pic: '', reviewer: '', dueDate: '', priority: 'Sedang', riskRating: 'Sedang' };
      setPreventiveActions(prev => [...prev, newAction]);
  };

  const handlePreventiveChange = (id: number, field: keyof Omit<PreventiveAction, 'id'>, value: string) => {
      setPreventiveActions(prev => prev.map(act => act.id === id ? { ...act, [field]: value } : act));
  };

  const removePreventiveAction = (id: number) => {
      setPreventiveActions(prev => prev.filter(act => act.id !== id));
  };

  // --- AI Suggestion & Enhancement Functions ---
  
  const enhanceText = async (
    textToEnhance: string,
    context: string,
    fieldId: string
  ) => {
    if (!textToEnhance.trim()) {
        alert("Mohon isi teks terlebih dahulu.");
        return null;
    }
    setEnhancingField(fieldId);
    setAiError('');
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: `Bertindak sebagai seorang ahli manajemen kualitas. Perbaiki dan format ulang teks berikut agar menjadi kalimat yang profesional, jelas, dan mudah dipahami untuk sebuah laporan corrective action. Konteks: ${context}. Teks asli: "${textToEnhance}". Berikan HANYA teks yang sudah diperbaiki, tanpa awalan, akhiran, atau penjelasan lain.`,
        });
        return response.text.trim();
    } catch (error) {
        console.error(`Error enhancing text for ${fieldId}:`, error);
        setAiError('Gagal menyempurnakan teks. Silakan coba lagi.');
        return null;
    } finally {
        setEnhancingField(null);
    }
  };

  const handleEnhanceDescription = async () => {
    const originalText = formData.description;
    const context = `Deskripsi masalah untuk laporan tindakan korektif.`;
    const fieldId = `description`;
    const enhancedText = await enhanceText(originalText, context, fieldId);
    if (enhancedText) {
        setFormData(prev => ({ ...prev, description: enhancedText }));
    }
  };

  const handleEnhanceFishbone = async (categoryId: number, causeIndex: number) => {
    const category = activeFishboneCategories.find(c => c.id === categoryId);
    if (!category) return;
    
    const originalText = category.causes[causeIndex];
    const categoryName = category.name === 'Lainnya...' ? category.customName : category.name;
    const context = `Potensi penyebab untuk kategori '${categoryName}' dalam diagram Fishbone.`;
    const fieldId = `fishbone-${categoryId}-${causeIndex}`;
    const enhancedText = await enhanceText(originalText, context, fieldId);
    if (enhancedText) {
        handleFishboneCauseChange(categoryId, causeIndex, enhancedText);
    }
  };

  const handleEnhance5Why = async (analysisId: number, whyIndex: number) => {
    const analysis = fiveWhyAnalyses.find(a => a.id === analysisId);
    if (!analysis) return;
    const originalText = analysis.whys[whyIndex];
    const context = `Jawaban untuk pertanyaan 'Why #${whyIndex + 2}' dalam analisis 5 Whys.`;
    const fieldId = `5why-${analysisId}-${whyIndex}`;
    const enhancedText = await enhanceText(originalText, context, fieldId);
    if (enhancedText) {
        handle5WhyInputChange(analysisId, whyIndex, enhancedText);
    }
  };

  const handleEnhanceContainment = async (id: number) => {
    const action = containmentActions.find(a => a.id === id);
    if (!action) return;
    const context = `Tindakan perbaikan segera (containment action).`;
    const fieldId = `containment-${id}`;
    const enhancedText = await enhanceText(action.action, context, fieldId);
    if (enhancedText) {
        handleContainmentChange(id, 'action', enhancedText);
    }
  };

  const handleEnhancePreventive = async (id: number) => {
      const action = preventiveActions.find(a => a.id === id);
      if (!action) return;
      const context = `Tindakan korektif dan preventif (CAPA).`;
      const fieldId = `capa-${id}`;
      const enhancedText = await enhanceText(action.action, context, fieldId);
      if (enhancedText) {
          handlePreventiveChange(id, 'action', enhancedText);
      }
  };

  // --- Row-by-row AI RCA & Action Suggestions ---

  const getAiFishboneCauseSuggestion = async (categoryId: number) => {
    const category = activeFishboneCategories.find(c => c.id === categoryId);
    if (!formData.description) {
        alert('Mohon isi "Deskripsi Masalah" terlebih dahulu.');
        return;
    }
    if (!category) return;

    const categoryName = category.name === 'Lainnya...' ? category.customName : category.name;
    if (!categoryName) {
        alert('Mohon tentukan nama kategori terlebih dahulu.');
        return;
    }

    const fieldId = `fishbone-${categoryId}`;
    setIsAiSuggesting(fieldId);
    setAiError('');
    try {
        const existingCauses = category.causes.join(', ');
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: `Bertindak sebagai ahli rekayasa kualitas. Untuk masalah "${formData.description}", berikan satu kemungkinan akar penyebab spesifik untuk kategori '${categoryName}'. Penyebab yang sudah ada untuk kategori ini: [${existingCauses}]. Berikan HONLY satu penyebab baru, singkat, dan jelas dalam Bahasa Indonesia. Jangan ulangi penyebab yang sudah ada. Berikan jawaban dalam bentuk kalimat pendek.`,
        });
        const newCause = response.text.trim();
        if (newCause) {
            setActiveFishboneCategories(prev => prev.map(cat => {
                if (cat.id === categoryId) {
                    const newCauses = [...cat.causes];
                    if (newCauses.length > 0 && newCauses[newCauses.length - 1].trim() === '') {
                        newCauses[newCauses.length - 1] = newCause;
                    } else {
                        newCauses.push(newCause);
                    }
                    return { ...cat, causes: newCauses };
                }
                return cat;
            }));
        }
    } catch (error) {
        console.error("Error fetching Fishbone cause suggestion:", error);
        setAiError(`Gagal mendapatkan saran AI untuk ${categoryName}.`);
    } finally {
        setIsAiSuggesting(null);
    }
  };

  const getAi5WhyStepSuggestion = async (analysisId: number, whyIndex: number) => {
    const analysis = fiveWhyAnalyses.find(a => a.id === analysisId);
    if (!formData.description) {
        alert('Mohon isi "Deskripsi Masalah" terlebih dahulu.');
        return;
    }
    if (!analysis) return;

    const contextSource = whyIndex === 0 ? analysis.initialCause : analysis.whys[whyIndex - 1];
    if (!contextSource) {
        alert(`Mohon isi "Why #${whyIndex + 1}" terlebih dahulu.`);
        return;
    }

    const fieldId = `5why-${analysisId}-${whyIndex}`;
    setIsAiSuggesting(fieldId);
    setAiError('');

    const context = `jawaban untuk "Why #${whyIndex}": "${contextSource}"`;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: `Bertindak sebagai ahli rekayasa kualitas. Lanjutkan analisis 5 Whys. Berdasarkan ${context}, apa jawaban logis untuk pertanyaan "Why #${whyIndex + 2}"? Berikan HANYA jawaban singkat dan jelas dalam Bahasa Indonesia.`,
        });
        const newWhy = response.text.trim();
        if (newWhy) {
            handle5WhyInputChange(analysisId, whyIndex, newWhy);
        }
    } catch (error) {
        console.error("Error fetching 5 Why step suggestion:", error);
        setAiError(`Gagal mendapatkan saran AI untuk Why #${whyIndex + 2}.`);
    } finally {
        setIsAiSuggesting(null);
    }
  };
  
    const getAiSingleActionSuggestion = async (actionType: 'containment' | 'capa', actionId: number) => {
        const action = actionType === 'containment'
            ? containmentActions.find(a => a.id === actionId)
            : preventiveActions.find(a => a.id === actionId);

        if (!action) return;

        const selectedRootCause = action.rootCauseReference;
        
        if (!selectedRootCause) {
            alert('Mohon pilih "Referensi Akar Masalah" terlebih dahulu untuk mendapatkan saran yang relevan.');
            return;
        }
        
        if (!formData.description) {
            alert('Mohon isi "Deskripsi Masalah" terlebih dahulu.');
            return;
        }

        const fieldId = `${actionType}-${actionId}`;
        setIsAiSuggesting(fieldId);
        setAiError('');

        let promptText = '';
        if (actionType === 'containment') {
            promptText = `Bertindak sebagai manajer kualitas. Masalahnya adalah: "${formData.description}". Akar masalah yang terkait adalah: "${selectedRootCause}". 
            Sarankan SATU tindakan KOREKSI SEGERA (containment action) yang spesifik untuk mengisolasi dan mengatasi dampak langsung dari masalah ini. Fokus pada penahanan masalah, bukan pencegahan jangka panjang.
            Berikan HANYA teks tindakan yang disarankan, dalam Bahasa Indonesia, tanpa awalan atau penjelasan.`;
        } else { // 'capa'
            promptText = `Bertindak sebagai ahli Corrective Action Preventive Action (CAPA). Masalah awal adalah: "${formData.description}". 
            Fokus utama pada akar penyebab berikut: "${selectedRootCause}".
            Sarankan SATU tindakan KOREKTIF DAN PREVENTIF yang SMART (Specific, Measurable, Achievable, Relevant, Time-bound) untuk menghilangkan akar penyebab ini dan mencegahnya terjadi lagi.
            Berikan HANYA teks tindakan yang disarankan, dalam Bahasa Indonesia, tanpa awalan atau penjelasan.`;
        }


        try {
            const response = await ai.models.generateContent({
                model: "gemini-2.5-flash",
                contents: promptText,
            });

            const suggestedActionText = response.text.trim();
            
            if (suggestedActionText) {
                if (actionType === 'containment') {
                    handleContainmentChange(actionId, 'action', suggestedActionText);
                } else { // 'capa'
                    handlePreventiveChange(actionId, 'action', suggestedActionText);
                }
            }
        } catch (error) {
            console.error(`Error fetching single ${actionType} suggestion:`, error);
            setAiError(`Gagal mendapatkan saran AI untuk tindakan ini. Silakan coba lagi.`);
        } finally {
            setIsAiSuggesting(null);
        }
    };


  const getFullReportData = () => {
    return {
        caseDetails: formData,
        rca: {
            method: activeRcaMethod,
            fishbone: activeFishboneCategories,
            fiveWhys: fiveWhyAnalyses,
        },
        actionPlan: {
            containment: containmentActions,
            capa: preventiveActions,
        }
    };
  };
  
  const generatePdf = (reportData: any) => {
    const doc = new jsPDF();
    const pageHeight = doc.internal.pageSize.height;
    let y = 20;

    const checkPageBreak = (spaceNeeded: number) => {
        if (y + spaceNeeded > pageHeight - 20) {
            doc.addPage();
            y = 20;
        }
    };

    // --- Header ---
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('Laporan Corrective Action', 105, y, { align: 'center' });
    y += 15;

    // --- Case Details ---
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('1. Detail Kasus', 14, y);
    y += 8;

    doc.setFontSize(10);
    const details = [
        { label: 'No. Referensi', value: reportData.caseDetails.referenceNumber },
        { label: 'Tanggal Kejadian', value: reportData.caseDetails.date },
        { label: 'Lokasi', value: reportData.caseDetails.location },
        { label: 'Pelanggan/No. Design', value: reportData.caseDetails.customerDesign },
        { label: 'No. SO', value: reportData.caseDetails.salesOrderNumber },
        { label: 'Kuantitas Terdampak', value: reportData.caseDetails.quantity },
        { label: 'Tingkat Keparahan', value: reportData.caseDetails.severity },
    ];

    let x = 14;
    details.forEach((item, index) => {
        doc.setFont('helvetica', 'bold');
        doc.text(item.label + ':', x, y);
        doc.setFont('helvetica', 'normal');
        doc.text(String(item.value || '-'), x + 45, y);
        if (index % 2 !== 0 || index === details.length - 1) {
            y += 7;
            x = 14;
        } else {
            x = 110;
        }
    });
    
    y += 5;

    // --- Problem Description ---
    doc.setFont('helvetica', 'bold');
    doc.text('Deskripsi Masalah:', 14, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    const descLines = doc.splitTextToSize(reportData.caseDetails.description, 180);
    doc.text(descLines, 14, y);
    y += (descLines.length * 5) + 10;

    checkPageBreak(30);

    // --- RCA ---
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('2. Analisis Akar Masalah', 14, y);
    y += 8;

    if (reportData.rca.method === 'fishbone') {
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text('Metode: Diagram Fishbone', 14, y);
        y += 7;
        doc.setFontSize(10);
        
        reportData.rca.fishbone.forEach((category: FishboneCategory) => {
            const categoryName = category.name === 'Lainnya...' ? category.customName : category.name;
            const validCauses = category.causes.filter(c => c && c.trim() !== '');

            if (categoryName && validCauses.length > 0) {
                checkPageBreak(10 + validCauses.length * 5);
                doc.setFont('helvetica', 'bold');
                doc.text(categoryName, 16, y);
                y += 5;
                doc.setFont('helvetica', 'normal');
                validCauses.forEach(cause => {
                    checkPageBreak(5);
                    const causeLines = doc.splitTextToSize(`- ${cause}`, 170);
                    doc.text(causeLines, 20, y);
                    y += causeLines.length * 5;
                });
                y += 3;
            }
        });

    } else { // 5 Whys
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text('Metode: 5 Why', 14, y);
        y += 7;
        reportData.rca.fiveWhys.forEach((analysis: FiveWhyAnalysis, analysisIndex: number) => {
            const allWhys = [analysis.initialCause, ...analysis.whys];
            const validWhys = allWhys.filter(w => w && w.trim() !== '');

            if (validWhys.length > 0) {
                checkPageBreak(20);
                doc.setFontSize(10);
                doc.setFont('helvetica', 'bold');
                doc.text(`Alur Analisis #${analysisIndex + 1}`, 16, y);
                y += 6;

                validWhys.forEach((why, whyIndex) => {
                    checkPageBreak(10);
                    doc.setFont('helvetica', 'bold');
                    doc.text(`Why #${whyIndex + 1}:`, 18, y);
                    doc.setFont('helvetica', 'normal');
                    const whyLines = doc.splitTextToSize(why, 155);
                    doc.text(whyLines, 38, y);
                    y += (whyLines.length * 5) + 2;
                });
                y += 4;
            }
        });
    }

    y += 5;
    checkPageBreak(50);

    // --- Action Plan ---
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('3. Rencana Tindakan (Action Plan)', 14, y);
    y += 8;
    
    if (reportData.actionPlan.containment.length > 0) {
        autoTable(doc, {
            startY: y,
            head: [['Koreksi']],
            theme: 'plain',
            headStyles: { font: 'helvetica', fontStyle: 'bold', fontSize: 11 }
        });
        autoTable(doc, {
            startY: (doc as any).lastAutoTable.finalY + 1,
            head: [['Referensi Akar Masalah', 'Tindakan', 'PIC', 'Target', 'Status']],
            body: reportData.actionPlan.containment.map((a: ContainmentAction) => [a.rootCauseReference, a.action, a.pic, a.dueDate, a.status]),
            theme: 'striped',
            headStyles: { fillColor: [60, 60, 60] },
            margin: { left: 14, right: 14 },
        });
        y = (doc as any).lastAutoTable.finalY + 10;
    }

    checkPageBreak(50);

    if (reportData.actionPlan.capa.length > 0) {
        autoTable(doc, {
            startY: y,
            head: [['Tindakan Korektif']],
            theme: 'plain',
            headStyles: { font: 'helvetica', fontStyle: 'bold', fontSize: 11 }
        });
        autoTable(doc, {
            startY: (doc as any).lastAutoTable.finalY + 1,
            head: [['Referensi Akar Masalah', 'Tindakan', 'PIC', 'Reviewer', 'Target', 'Prioritas', 'Risiko']],
            body: reportData.actionPlan.capa.map((a: PreventiveAction) => [a.rootCauseReference, a.action, a.pic, a.reviewer, a.dueDate, a.priority, a.riskRating]),
            theme: 'striped',
            headStyles: { fillColor: [60, 60, 60] },
            margin: { left: 14, right: 14 },
        });
    }
    
    doc.save(`laporan-${reportData.caseDetails.referenceNumber || 'kasus-baru'}.pdf`);
  };

  const generateXlsx = (reportData: any) => {
    const wb = XLSX.utils.book_new();

    // Sheet 1: Detail Kasus
    const caseDetailsData = [
      { 'Field': 'No. Referensi', 'Value': reportData.caseDetails.referenceNumber },
      { 'Field': 'Tanggal Kejadian', 'Value': reportData.caseDetails.date },
      { 'Field': 'Lokasi', 'Value': reportData.caseDetails.location },
      { 'Field': 'Pelanggan/No. Design', 'Value': reportData.caseDetails.customerDesign },
      { 'Field': 'No. SO', 'Value': reportData.caseDetails.salesOrderNumber },
      { 'Field': 'Kuantitas Terdampak', 'Value': reportData.caseDetails.quantity },
      { 'Field': 'Tingkat Keparahan', 'Value': reportData.caseDetails.severity },
      { 'Field': 'Deskripsi Masalah', 'Value': reportData.caseDetails.description },
    ];
    const ws1 = XLSX.utils.json_to_sheet(caseDetailsData);
    XLSX.utils.book_append_sheet(wb, ws1, "Detail Kasus");

    // Sheet 2: Analisis Akar Masalah
    let rcaData: any[] = [];
    if (reportData.rca.method === 'fishbone') {
        reportData.rca.fishbone.forEach((category: FishboneCategory) => {
            const categoryName = category.name === 'Lainnya...' ? category.customName : category.name.split('→')[0].trim();
            category.causes.filter(c => c && c.trim() !== '').forEach(cause => {
                rcaData.push({ 'Kategori': categoryName, 'Potensi Penyebab': cause });
            });
        });
    } else { // 5 Whys
        reportData.rca.fiveWhys.forEach((analysis: FiveWhyAnalysis, index: number) => {
            if(analysis.initialCause) rcaData.push({ 'Analisis': `Analisis #${index + 1}`, 'Langkah': 'Why #1 (Initial Cause)', 'Deskripsi': analysis.initialCause });
            analysis.whys.forEach((why, whyIndex) => {
                if(why) rcaData.push({ 'Analisis': `Analisis #${index + 1}`, 'Langkah': `Why #${whyIndex + 2}`, 'Deskripsi': why });
            });
        });
    }
    const ws2 = XLSX.utils.json_to_sheet(rcaData);
    XLSX.utils.book_append_sheet(wb, ws2, "Analisis Akar Masalah");

    // Sheet 3: Koreksi
    if (reportData.actionPlan.containment.length > 0) {
      const containmentData = reportData.actionPlan.containment.map((a: ContainmentAction) => ({
        'Referensi Akar Masalah': a.rootCauseReference,
        'Tindakan': a.action,
        'PIC': a.pic,
        'Target Penyelesaian': a.dueDate,
        'Status': a.status
      }));
      const ws3 = XLSX.utils.json_to_sheet(containmentData);
      XLSX.utils.book_append_sheet(wb, ws3, "Koreksi");
    }

    // Sheet 4: Tindakan Korektif
    if (reportData.actionPlan.capa.length > 0) {
       const capaData = reportData.actionPlan.capa.map((a: PreventiveAction) => ({
        'Referensi Akar Masalah': a.rootCauseReference,
        'Tindakan': a.action,
        'PIC': a.pic,
        'Reviewer': a.reviewer,
        'Target Penyelesaian': a.dueDate,
        'Prioritas': a.priority,
        'Rating Risiko': a.riskRating
      }));
      const ws4 = XLSX.utils.json_to_sheet(capaData);
      XLSX.utils.book_append_sheet(wb, ws4, "Tindakan Korektif");
    }

    XLSX.writeFile(wb, `laporan-${reportData.caseDetails.referenceNumber || 'kasus-baru'}.xlsx`);
  };

  const handlePrintPdf = (e: React.FormEvent) => {
    e.preventDefault();
    const fullReport = getFullReportData();
    generatePdf(fullReport);
    alert('Laporan PDF berhasil dibuat dan diunduh!');
  };

  const handleExportExcel = () => {
    const fullReport = getFullReportData();
    generateXlsx(fullReport);
     alert('Laporan Excel berhasil dibuat dan diunduh!');
  };
  
  const handleNextCase = () => {
    // Reset React state
    setFormData({
        referenceNumber: '',
        date: new Date().toISOString().split('T')[0],
        location: '',
        customerDesign: '',
        salesOrderNumber: '',
        quantity: '',
        severity: 'Medium',
        description: '',
        evidence: null,
    });
    setActiveFishboneCategories([]);
    setFiveWhyAnalyses([]);
    setContainmentActions([]);
    setPreventiveActions([]);
    setActiveRcaMethod('fishbone');
    setAiError('');
    setEnhancingField(null);
    setIsAiSuggesting(null);

    // Reset the actual form DOM element
    const formElement = document.querySelector('.case-form');
    if (formElement) {
        (formElement as HTMLFormElement).reset();
    }
    
    window.scrollTo(0, 0);
    alert('Formulir telah direset untuk kasus selanjutnya.');
  };

  const allFishboneCauses = useMemo(() => {
    const causes: { text: string; category: string }[] = [];
    activeFishboneCategories.forEach(category => {
      const categoryName = (category.name === 'Lainnya...' ? category.customName : category.name.split('→')[0].trim()) || 'Tanpa Kategori';
      category.causes.forEach(cause => {
        if (cause && cause.trim() !== '') {
          causes.push({
            text: cause,
            category: categoryName
          });
        }
      });
    });
    return causes;
  }, [activeFishboneCategories]);
  
  const identifiedRootCauses = useMemo(() => {
    const allCauses: string[] = [];
    fiveWhyAnalyses.forEach((analysis, analysisIndex) => {
      if (analysis.initialCause && analysis.initialCause.trim() !== '') {
        allCauses.push(`[Analisis #${analysisIndex + 1}] Why #1: ${analysis.initialCause}`);
      }
      analysis.whys.forEach((why, whyIndex) => {
        if (why && why.trim() !== '') {
          allCauses.push(`[Analisis #${analysisIndex + 1}] Why #${whyIndex + 2}: ${why}`);
        }
      });
    });
    return allCauses;
  }, [fiveWhyAnalyses]);

  // --- Render Method ---
  return (
    <div className="app-container">
      <header className="app-header">
        <div className="logo">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="url(#grad1)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M2 17L12 22L22 17" stroke="url(#grad2)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M2 12L12 17L22 12" stroke="url(#grad3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <defs>
              <linearGradient id="grad1" x1="12" y1="2" x2="12" y2="12" gradientUnits="userSpaceOnUse">
                <stop stopColor="#D946EF"/>
                <stop offset="1" stopColor="#8B5CF6"/>
              </linearGradient>
              <linearGradient id="grad2" x1="12" y1="17" x2="12" y2="22" gradientUnits="userSpaceOnUse">
                <stop stopColor="#8B5CF6"/>
                <stop offset="1" stopColor="#3B82F6"/>
              </linearGradient>
               <linearGradient id="grad3" x1="12" y1="12" x2="12" y2="17" gradientUnits="userSpaceOnUse">
                <stop stopColor="#F472B6"/>
                <stop offset="1" stopColor="#A78BFA"/>
              </linearGradient>
            </defs>
          </svg>
        </div>
        <div className="header-text">
            <h1>Tindakan Perbaikan</h1>
            <p>Ketidaksesuaian Produk, Klaim dan Komplain Pelanggan</p>
        </div>
      </header>
      <main className="form-container">
        <form onSubmit={(e) => e.preventDefault()} className="case-form">
          {/* Case Details Form */}
          <div className="form-grid">
            <div className="form-group">
              <label htmlFor="referenceNumber">
                  Nomor Referensi
                  <span className="tooltip-icon" data-tooltip="Masukkan nomor referensi unik untuk kasus ini.">i</span>
              </label>
              <input type="text" id="referenceNumber" name="referenceNumber" value={formData.referenceNumber} onChange={handleInputChange} placeholder="contoh : 18/TCP/MR-05/VIII/2025" required />
            </div>
            <div className="form-group">
              <label htmlFor="date">
                  Tanggal Kejadian
                  <span className="tooltip-icon" data-tooltip="Pilih tanggal kapan masalah ini pertama kali terjadi atau ditemukan.">i</span>
              </label>
              <input type="date" id="date" name="date" value={formData.date} onChange={handleInputChange} required />
            </div>
            <div className="form-group">
              <label htmlFor="location">
                  Lokasi
                  <span className="tooltip-icon" data-tooltip="Lokasi spesifik di mana masalah terjadi (misal: Gudang, Line Produksi A).">i</span>
              </label>
              <input type="text" id="location" name="location" value={formData.location} onChange={handleInputChange} placeholder="contoh: Bagian Printing" required />
            </div>
            <div className="form-group">
              <label htmlFor="customerDesign">
                  Pelanggan No Design
                  <span className="tooltip-icon" data-tooltip="Nama pelanggan dan nomor atau nama desain produk yang terkait.">i</span>
              </label>
              <input type="text" id="customerDesign" name="customerDesign" value={formData.customerDesign} onChange={handleInputChange} placeholder="Contoh : LajuSarana 12356/4" required />
            </div>
            <div className="form-group">
              <label htmlFor="salesOrderNumber">
                  No. SO
                  <span className="tooltip-icon" data-tooltip="Nomor Sales Order yang berhubungan dengan produk terdampak.">i</span>
              </label>
              <input type="text" id="salesOrderNumber" name="salesOrderNumber" value={formData.salesOrderNumber} onChange={handleInputChange} placeholder="Contoh: 1-022025-00215" required />
            </div>
            <div className="form-group">
              <label htmlFor="quantity">
                  Kuantitas Terdampak
                  <span className="tooltip-icon" data-tooltip="Jumlah unit produk yang terpengaruh. Bisa berupa angka, satuan, atau deskripsi singkat.">i</span>
              </label>
              <textarea id="quantity" name="quantity" value={formData.quantity} onChange={handleInputChange} placeholder="Contoh: 100 pcs, 2 roll, 1 palet" rows={2} required></textarea>
            </div>
            <div className="form-group full-width">
              <label htmlFor="severity">
                  Tingkat Keparahan (Severity)
                  <span className="tooltip-icon" data-tooltip={`Definisi Tingkat Keparahan:\n\n• Rendah: Dampak minor pada penampilan atau fungsi non-esensial. Tidak menyebabkan penolakan produk.\n\n• Sedang: Mempengaruhi fungsi produk, memerlukan perbaikan atau rework, namun tidak menyebabkan bahaya.\n\n• Tinggi: Kegagalan fungsi utama, kerusakan signifikan, atau isu yang pasti menyebabkan keluhan pelanggan.\n\n• Kritis: Pelanggaran keamanan, regulasi, atau hukum. Dapat menyebabkan cedera, kerusakan properti, atau penghentian total produksi.`}>i</span>
              </label>
              <select id="severity" name="severity" value={formData.severity} onChange={handleInputChange} required>
                <option value="Low">Rendah</option>
                <option value="Medium">Sedang</option>
                <option value="High">Tinggi</option>
                <option value="Critical">Kritis</option>
              </select>
            </div>
            <div className="form-group full-width">
              <label htmlFor="description">
                  Deskripsi Masalah
                  <span className="tooltip-icon" data-tooltip="Jelaskan masalah secara rinci, termasuk apa yang terjadi dan di mana.">i</span>
              </label>
              <div className="input-with-enhance">
                  <textarea id="description" name="description" rows={5} value={formData.description} onChange={handleInputChange} placeholder="Jelaskan masalah secara detail..." required></textarea>
                  <div className="input-buttons">
                      <button
                          type="button"
                          className="enhance-btn"
                          onClick={handleEnhanceDescription}
                          disabled={enhancingField === 'description'}
                          title="Sempurnakan dengan AI"
                      >
                          {enhancingField === 'description' ? '...' : '✨'}
                      </button>
                  </div>
              </div>
            </div>
            <div className="form-group full-width">
              <label htmlFor="evidence">
                  Unggah Bukti (Foto/Dokumen)
                  <span className="tooltip-icon" data-tooltip="Unggah file seperti foto atau dokumen sebagai bukti pendukung.">i</span>
              </label>
              <input type="file" id="evidence" name="evidence" onChange={handleFileChange} />
            </div>
          </div>

          {/* RCA Section */}
          <div className="rca-section">
              <header className="section-header">
                  <h2>Analisis Akar Masalah</h2>
              </header>
              <div className="rca-tabs">
                  <button type="button" className={`tab-btn ${activeRcaMethod === 'fishbone' ? 'active' : ''}`} onClick={() => setActiveRcaMethod('fishbone')}>
                      Diagram Fishbone
                      <span className="tooltip-icon" data-tooltip="Analisis visual untuk mengidentifikasi semua kemungkinan penyebab masalah dengan mengkategorikannya.">i</span>
                  </button>
                  <button type="button" className={`tab-btn ${activeRcaMethod === '5why' ? 'active' : ''}`} onClick={() => setActiveRcaMethod('5why')}>
                      Metode 5 Why
                      <span className="tooltip-icon" data-tooltip="Teknik bertanya 'Mengapa?' berulang kali untuk menggali dari gejala masalah hingga menemukan akar penyebabnya.">i</span>
                  </button>
              </div>
              <div className="rca-content">
                  {isAiSuggesting && <div className="loading-overlay"><span>AI sedang berpikir...</span></div>}
                  {aiError && <div className="ai-error">{aiError}</div>}
                  {activeRcaMethod === 'fishbone' && (
                      <div id="fishbone-analysis">
                          <div className="fishbone-grid">
                            {activeFishboneCategories.map((category) => (
                                  <div key={category.id} className="fishbone-category">
                                      <div className="fishbone-category-header">
                                          <select 
                                              value={category.name}
                                              onChange={(e) => handleFishboneCategoryChange(category.id, 'name', e.target.value)}
                                          >
                                            {fishboneCategoryGroups.map(group => (
                                                  <optgroup label={group.name} key={group.name}>
                                                      {group.subCategories.map(subCategory => (
                                                          <option key={subCategory} value={subCategory}>
                                                              {subCategory.split('→')[0].trim()}
                                                          </option>
                                                      ))}
                                                  </optgroup>
                                              ))}
                                              <option value="Lainnya...">Lainnya...</option>
                                          </select>
                                          {category.name === 'Lainnya...' && (
                                              <input 
                                                  type="text"
                                                  className="custom-category-input"
                                                  placeholder="Nama Kategori Kustom"
                                                  value={category.customName}
                                                  onChange={(e) => handleFishboneCategoryChange(category.id, 'customName', e.target.value)}
                                              />
                                          )}
                                          <button 
                                              type="button" 
                                              className="remove-category-btn"
                                              onClick={() => removeFishboneCategory(category.id)}
                                              title="Hapus Kategori"
                                          >×</button>
                                      </div>

                                      <button
                                          type="button"
                                          className="ai-suggest-cause-btn"
                                          onClick={() => getAiFishboneCauseSuggestion(category.id)}
                                          disabled={isAiSuggesting === `fishbone-${category.id}`}
                                      >
                                          {isAiSuggesting === `fishbone-${category.id}` ? '...' : '✨ Sarankan Penyebab'}
                                      </button>

                                      <div className="causes-list">
                                          {category.causes.map((cause, index) => {
                                            const fieldId = `fishbone-${category.id}-${index}`;
                                            return (
                                              <div key={index} className="cause-item">
                                                  <textarea
                                                      value={cause}
                                                      onChange={(e) => handleFishboneCauseChange(category.id, index, e.target.value)}
                                                      placeholder="Potensi penyebab..."
                                                      rows={4}
                                                  />
                                                  <div className="input-buttons-vertical">
                                                    <button type="button" className="enhance-btn" onClick={() => handleEnhanceFishbone(category.id, index)} disabled={enhancingField === fieldId} title="Sempurnakan dengan AI">
                                                        {enhancingField === fieldId ? '...' : '✨'}
                                                    </button>
                                                    <button type="button" className="remove-cause-btn" onClick={() => removeFishboneCause(category.id, index)} title="Hapus penyebab">×</button>
                                                  </div>
                                              </div>
                                            );
                                          })}
                                          <button type="button" className="add-cause-btn" onClick={() => addFishboneCause(category.id)}>+ Tambah Penyebab</button>
                                      </div>
                                  </div>
                              ))}
                          </div>
                          <button type="button" className="add-category-btn" onClick={addFishboneCategory}>+ Tambah Kategori</button>
                      </div>
                  )}
                  {activeRcaMethod === '5why' && (
                      <div id="5why-analysis">
                        {fiveWhyAnalyses.map((analysis, analysisIndex) => (
                          <div key={analysis.id} className="five-why-analysis-block">
                            <div className="five-why-analysis-header">
                              <h4>Analisis 5 Why #{analysisIndex + 1}</h4>
                              <button 
                                type="button" 
                                className="remove-analysis-btn" 
                                onClick={() => removeFiveWhyAnalysis(analysis.id)}
                                title="Hapus Analisis Ini"
                              >×</button>
                            </div>

                            <div className="five-whys-container">
                              <div className="form-group">
                                <label htmlFor={`why-1-${analysis.id}`}>
                                  Why #1 (Pilih dari Fishbone)
                                  <span className="tooltip-icon" data-tooltip="Pilih penyebab paling relevan dari Diagram Fishbone sebagai titik awal analisis 5 Why.">i</span>
                                </label>
                                <select 
                                  id={`why-1-${analysis.id}`}
                                  value={analysis.initialCause} 
                                  onChange={(e) => handle5WhyInputChange(analysis.id, -1, e.target.value)}
                                  disabled={allFishboneCauses.length === 0}
                                >
                                  <option value="">
                                    {allFishboneCauses.length === 0 
                                      ? "Isi Diagram Fishbone terlebih dahulu" 
                                      : "-- Pilih akar masalah dari diagram Fishbone --"}
                                  </option>
                                  {allFishboneCauses.map((cause, causeIndex) => (
                                    <option key={causeIndex} value={cause.text}>
                                      [{cause.category}] {cause.text}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              
                              {analysis.whys.map((why, whyIndex) => {
                                  const fieldId = `5why-${analysis.id}-${whyIndex}`;
                                  const prevWhy = whyIndex === 0 ? analysis.initialCause : analysis.whys[whyIndex - 1];
                                  return (
                                  <div key={whyIndex} className="form-group">
                                      <label htmlFor={`why-${whyIndex+2}-${analysis.id}`}>Why #{whyIndex+2}</label>
                                      <div className="input-with-enhance">
                                        <textarea 
                                          id={`why-${whyIndex+2}-${analysis.id}`}
                                          value={why} 
                                          onChange={(e) => handle5WhyInputChange(analysis.id, whyIndex, e.target.value)} 
                                          placeholder={`Jawaban untuk "Mengapa #${whyIndex+2}"...`} 
                                          rows={2}
                                          disabled={!prevWhy}
                                        />
                                        <div className="input-buttons">
                                            <button
                                                type="button"
                                                className="ai-suggest-btn"
                                                onClick={() => getAi5WhyStepSuggestion(analysis.id, whyIndex)}
                                                disabled={isAiSuggesting === fieldId || !prevWhy}
                                                title="Sarankan jawaban (AI)"
                                            >
                                                {isAiSuggesting === fieldId ? '...' : '🧠'}
                                            </button>
                                            <button type="button" className="enhance-btn" onClick={() => handleEnhance5Why(analysis.id, whyIndex)} disabled={enhancingField === fieldId || !why} title="Sempurnakan dengan AI">
                                                {enhancingField === fieldId ? '...' : '✨'}
                                            </button>
                                            <button type="button" className="remove-why-btn" onClick={() => removeFiveWhy(analysis.id, whyIndex)} title="Hapus Why">×</button>
                                        </div>
                                      </div>
                                  </div>
                                  );
                              })}
                              {analysis.initialCause && <button type="button" className="add-why-btn-inline" onClick={() => addFiveWhy(analysis.id)}>+ Tambah Why</button>}
                            </div>
                          </div>
                        ))}
                        <button type="button" className="add-analysis-btn" onClick={addFiveWhyAnalysis}>+ Tambah Analisis 5 Why Baru</button>
                      </div>
                  )}
              </div>
          </div>

          {/* Action Plan Section */}
          <div className="action-plan-section">
              <header className="section-header">
                  <h2>Rencana Tindakan (Action Plan)</h2>
              </header>

              {/* Containment Actions */}
              <div className="subsection">
                  <div className="subsection-header">
                      <h3>Koreksi</h3>
                       <div className="subsection-header-actions">
                          <button type="button" className="add-action-btn" onClick={addContainmentAction}>+ Tambah Tindakan</button>
                       </div>
                  </div>
                  <div className="action-list">
                      {containmentActions.map((item) => {
                          const fieldId = `containment-${item.id}`;
                          return (
                          <div key={item.id} className="action-item containment-item">
                              <div className="action-field action-field--full">
                                  <label htmlFor={`containment-cause-${item.id}`}>Referensi Akar Masalah</label>
                                  <select 
                                      id={`containment-cause-${item.id}`}
                                      value={item.rootCauseReference}
                                      onChange={(e) => handleContainmentChange(item.id, 'rootCauseReference', e.target.value)}
                                      disabled={identifiedRootCauses.length === 0}
                                  >
                                      <option value="">{identifiedRootCauses.length === 0 ? 'Selesaikan Analisis 5 Why dahulu' : '-- Pilih Akar Masalah --'}</option>
                                      {identifiedRootCauses.map((cause, index) => (
                                          <option key={index} value={cause}>{cause}</option>
                                      ))}
                                  </select>
                              </div>
                              <div className="action-field action-field--full">
                                <label htmlFor={`containment-action-${item.id}`}>Tindakan</label>
                                <div className="input-with-enhance">
                                  <textarea id={`containment-action-${item.id}`} value={item.action} onChange={(e) => handleContainmentChange(item.id, 'action', e.target.value)} placeholder="Deskripsi tindakan..." rows={2}></textarea>
                                  <div className="input-buttons">
                                    <button
                                        type="button"
                                        className="ai-suggest-btn"
                                        onClick={() => getAiSingleActionSuggestion('containment', item.id)}
                                        disabled={isAiSuggesting === fieldId}
                                        title="Sarankan tindakan (AI)"
                                    >
                                        {isAiSuggesting === fieldId ? '...' : '🧠'}
                                    </button>
                                    <button type="button" className="enhance-btn" onClick={() => handleEnhanceContainment(item.id)} disabled={enhancingField === fieldId || !item.action} title="Sempurnakan dengan AI">
                                        {enhancingField === fieldId ? '...' : '✨'}
                                    </button>
                                  </div>
                                </div>
                              </div>
                              <div className="action-field">
                                  <label htmlFor={`containment-pic-${item.id}`}>PIC</label>
                                  <input id={`containment-pic-${item.id}`} type="text" value={item.pic} onChange={(e) => handleContainmentChange(item.id, 'pic', e.target.value)} placeholder="PIC" />
                              </div>
                              <div className="action-field">
                                  <label htmlFor={`containment-due-${item.id}`}>Target Penyelesaian (Tgl)</label>
                                  <input id={`containment-due-${item.id}`} type="date" value={item.dueDate} onChange={(e) => handleContainmentChange(item.id, 'dueDate', e.target.value)} placeholder="Jatuh Tempo" />
                              </div>
                              <div className="action-field">
                                  <label htmlFor={`containment-status-${item.id}`}>Status</label>
                                  <select id={`containment-status-${item.id}`} value={item.status} onChange={(e) => handleContainmentChange(item.id, 'status', e.target.value)}>
                                      <option>Belum Mulai</option>
                                      <option>Sedang Dikerjakan</option>
                                      <option>Selesai</option>
                                      <option>Dibatalkan</option>
                                  </select>
                              </div>
                              <button type="button" className="remove-action-btn" onClick={() => removeContainmentAction(item.id)}>Hapus</button>
                          </div>
                          );
                      })}
                  </div>
              </div>

              {/* CAPA */}
              <div className="subsection">
                  <div className="subsection-header">
                      <h3>Tindakan Korektif</h3>
                      <div className="subsection-header-actions">
                          <button type="button" className="add-action-btn" onClick={addPreventiveAction}>+ Tambah Tindakan</button>
                      </div>
                  </div>
                  <div className="action-list">
                      {preventiveActions.map((item) => {
                          const fieldId = `capa-${item.id}`;
                          return (
                          <div key={item.id} className="action-item capa-item">
                              <div className="action-field action-field--full">
                                  <label htmlFor={`capa-cause-${item.id}`}>Referensi Akar Masalah</label>
                                  <select 
                                      id={`capa-cause-${item.id}`}
                                      value={item.rootCauseReference}
                                      onChange={(e) => handlePreventiveChange(item.id, 'rootCauseReference', e.target.value)}
                                      disabled={identifiedRootCauses.length === 0}
                                  >
                                      <option value="">{identifiedRootCauses.length === 0 ? 'Selesaikan Analisis 5 Why dahulu' : '-- Pilih Akar Masalah --'}</option>
                                      {identifiedRootCauses.map((cause, index) => (
                                          <option key={index} value={cause}>{cause}</option>
                                      ))}
                                  </select>
                              </div>
                              <div className="action-field action-field--full">
                                  <label htmlFor={`capa-action-${item.id}`}>Tindakan</label>
                                  <div className="input-with-enhance">
                                  <textarea id={`capa-action-${item.id}`} value={item.action} onChange={(e) => handlePreventiveChange(item.id, 'action', e.target.value)} placeholder="Deskripsi tindakan..." rows={3}></textarea>
                                  <div className="input-buttons">
                                    <button
                                        type="button"
                                        className="ai-suggest-btn"
                                        onClick={() => getAiSingleActionSuggestion('capa', item.id)}
                                        disabled={isAiSuggesting === fieldId}
                                        title="Sarankan tindakan (AI)"
                                    >
                                        {isAiSuggesting === fieldId ? '...' : '🧠'}
                                    </button>
                                    <button type="button" className="enhance-btn" onClick={() => handleEnhancePreventive(item.id)} disabled={enhancingField === fieldId || !item.action} title="Sempurnakan dengan AI">
                                        {enhancingField === fieldId ? '...' : '✨'}
                                    </button>
                                  </div>
                                  </div>
                              </div>
                              <div className="action-field">
                                  <label htmlFor={`capa-pic-${item.id}`}>PIC</label>
                                  <input id={`capa-pic-${item.id}`} type="text" value={item.pic} onChange={(e) => handlePreventiveChange(item.id, 'pic', e.target.value)} placeholder="PIC" />
                              </div>
                              <div className="action-field">
                                  <label htmlFor={`capa-reviewer-${item.id}`}>Reviewer</label>
                                  <input id={`capa-reviewer-${item.id}`} type="text" value={item.reviewer} onChange={(e) => handlePreventiveChange(item.id, 'reviewer', e.target.value)} placeholder="Reviewer" />
                              </div>
                              <div className="action-field">
                                  <label htmlFor={`capa-due-${item.id}`}>Target Penyelesaian (Tgl)</label>
                                  <input id={`capa-due-${item.id}`} type="date" value={item.dueDate} onChange={(e) => handlePreventiveChange(item.id, 'dueDate', e.target.value)} placeholder="Jatuh Tempo" />
                              </div>
                              <div className="action-field">
                                  <label htmlFor={`capa-priority-${item.id}`}>Prioritas</label>
                                  <select id={`capa-priority-${item.id}`} value={item.priority} onChange={(e) => handlePreventiveChange(item.id, 'priority', e.target.value)}>
                                      <option>Rendah</option>
                                      <option>Sedang</option>
                                      <option>Tinggi</option>
                                  </select>
                              </div>
                              <div className="action-field">
                                  <label htmlFor={`capa-risk-${item.id}`}>Rating Risiko</label>
                                  <select id={`capa-risk-${item.id}`} value={item.riskRating} onChange={(e) => handlePreventiveChange(item.id, 'riskRating', e.target.value)}>
                                      <option>Rendah</option>
                                      <option>Sedang</option>
                                      <option>Tinggi</option>
                                  </select>
                              </div>
                              <button type="button" className="remove-action-btn" onClick={() => removePreventiveAction(item.id)}>Hapus</button>
                          </div>
                          );
                      })}
                  </div>
              </div>
          </div>

          <div className="form-actions">
            <button type="button" className="next-case-btn" onClick={handleNextCase}>
              Kasus Selanjutnya
            </button>
            <button type="button" className="excel-btn" onClick={handleExportExcel}>
              Ekspor Excel
            </button>
            <button type="button" className="submit-btn" onClick={handlePrintPdf}>
              Cetak PDF
            </button>
          </div>
        </form>
      </main>
    </div>
  );
};

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(
  <React.StrictMode>
    <NewCaseForm />
  </React.StrictMode>
);