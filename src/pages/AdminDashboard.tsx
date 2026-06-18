import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { collection, query, onSnapshot, doc, addDoc, updateDoc, setDoc, deleteDoc, writeBatch } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Plus, Trash2, RotateCcw, AlertTriangle, Users, BookOpen, Download, UserCheck, Shield, Settings, CheckCircle2, Eye, EyeOff, ClipboardCheck, Award, Sparkles, Loader2, Check } from 'lucide-react';
import { format } from 'date-fns';
import SubmissionsView from '../components/SubmissionsView';

interface Topic {
  id: string;
  title: string;
  description: string;
  subject?: string;
  status: 'Available' | 'Taken';
  studentId?: string;
  studentName?: string;
  studentBatch?: string;
  studentEmail?: string;
  timestamp?: string;
  deadline?: string | null;
  createdAt?: string;
  topicEmail?: string;
  published?: boolean;
  assignmentSubmitted?: boolean;
  submissionMessage?: string;
  submissionTimestamp?: string;
  submittedFileName?: string;
  grade?: number | null;
  gradeOutOf?: number | null;
  gradedAt?: string;
  gradeMessage?: string;
  graded?: boolean;
}

export default function AdminDashboard() {
  const { user } = useAuth();
  const [topics, setTopics] = useState<Topic[]>([]);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'topics' | 'submissions' | 'users' | 'settings'>('topics');
  const [selectedSubject, setSelectedSubject] = useState<string>('All');
  
  // New topic form
  const [isAdding, setIsAdding] = useState(false);
  const [subject, setSubject] = useState('');
  const [topicDeadline, setTopicDeadline] = useState<string>('');
  const [topicEmail, setTopicEmail] = useState('');
  const [topicInputs, setTopicInputs] = useState([{ title: '', description: '' }]);

  // AI Topic Generator state
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiSubject, setAiSubject] = useState('');
  const [aiCount, setAiCount] = useState<number>(3);
  const [aiLoading, setAiLoading] = useState(false);
  const [generatedTopics, setGeneratedTopics] = useState<Array<{ title: string; description: string; subject: string; selected: boolean }>>([]);

  // Confirmation state
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => Promise<void>;
  } | null>(null);

  // Custom alert/notification system
  const [panelNotification, setPanelNotification] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);

  const showNotification = (type: 'success' | 'error' | 'info', msg: string) => {
    setPanelNotification({ type, message: msg });
    setTimeout(() => {
      setPanelNotification(prev => prev?.message === msg ? null : prev);
    }, 5000);
  };

  // Settings form
  const [adminEmail, setAdminEmail] = useState('');
  const [deadlineDays, setDeadlineDays] = useState<number | ''>(2);
  const [subjectEmails, setSubjectEmails] = useState<Record<string, string>>({});
  const [appName, setAppName] = useState('As-Sunnah Dawah & Research Institute');
  const [appSubtitle, setAppSubtitle] = useState('Topic Selection & Locking System');
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  useEffect(() => {
    if (!user) return;

    const qTopics = query(collection(db, "topics"));
    const unsubscribeTopics = onSnapshot(qTopics, (snapshot) => {
      const topicsData: Topic[] = [];
      snapshot.forEach((doc) => {
        topicsData.push({ id: doc.id, ...doc.data() } as Topic);
      });
      topicsData.sort((a, b) => a.title.localeCompare(b.title));
      setTopics(topicsData);
      setLoading(false);
    }, (error) => {
      console.warn("Topics listener error:", error);
      setLoading(false);
    });

    const qUsers = query(collection(db, "users"));
    const unsubscribeUsers = onSnapshot(qUsers, (snapshot) => {
      const usersData: any[] = [];
      snapshot.forEach((doc) => {
        usersData.push({ id: doc.id, ...doc.data() });
      });
      setUsersList(usersData);
    }, (error) => {
      console.warn("Users listener error:", error);
    });

    const qSettings = doc(db, "settings", "general");
    const unsubscribeSettings = onSnapshot(qSettings, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.adminEmail !== undefined) setAdminEmail(data.adminEmail);
        if (data.deadlineDays !== undefined) setDeadlineDays(data.deadlineDays);
        if (data.subjectEmails !== undefined) setSubjectEmails(data.subjectEmails);
        if (data.appName !== undefined) setAppName(data.appName);
        if (data.appSubtitle !== undefined) setAppSubtitle(data.appSubtitle);
      }
    }, (error) => {
      console.warn("Settings listener error:", error);
    });

    return () => {
      unsubscribeTopics();
      unsubscribeUsers();
      unsubscribeSettings();
    };
  }, [user]);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSettings(true);
    try {
      try {
        await updateDoc(doc(db, "settings", "general"), {
          adminEmail,
          deadlineDays: Number(deadlineDays) || 2,
          subjectEmails,
          appName,
          appSubtitle
        });
      } catch (err) {
        await setDoc(doc(db, "settings", "general"), {
          adminEmail,
          deadlineDays: Number(deadlineDays) || 2,
          subjectEmails,
          appName,
          appSubtitle
        });
      }
      showNotification('success', 'Settings saved successfully!');
    } catch (e: any) {
      console.error(e);
      showNotification('error', 'Failed to save settings: ' + (e?.message || e));
    } finally {
      setIsSavingSettings(false);
    }
  };

  const executeToggleRole = async (userId: string, currentRole: string) => {
    try {
      const newRole = currentRole === 'admin' ? 'student' : 'admin';
      await updateDoc(doc(db, "users", userId), { role: newRole });
      showNotification('success', 'User role updated successfully!');
    } catch (error: any) {
      console.error("Error updating role:", error);
      showNotification('error', "Failed to update user role: " + (error?.message || error));
    }
  };

  const handleToggleRole = (userId: string, currentRole: string) => {
    const actionLabel = currentRole === 'admin' ? 'revoke admin access' : 'grant admin access';
    setConfirmModal({
      isOpen: true,
      title: 'Change User Role?',
      message: `Are you sure you want to ${actionLabel} for this user?`,
      onConfirm: async () => {
        await executeToggleRole(userId, currentRole);
      }
    });
  };

  // Export form
  const [exportSubject, setExportSubject] = useState('All');

  const handleExportCSV = () => {
    const subjectsToExport = exportSubject === 'All' ? topics : topics.filter(t => t.subject === exportSubject);

    const headers = ['Topic ID', 'Topic Title', 'Subject', 'Description', 'Status', 'Student Name', 'Student Batch', 'Booking Time'];
    const rows = subjectsToExport.map(t => [
      t.id,
      `"${t.title.replace(/"/g, '""')}"`,
      `"${(t.subject || '').replace(/"/g, '""')}"`,
      `"${(t.description || '').replace(/"/g, '""')}"`,
      t.status,
      `"${(t.studentName || '').replace(/"/g, '""')}"`,
      `"${(t.studentBatch || '').replace(/"/g, '""')}"`,
      t.timestamp ? new Date(t.timestamp).toLocaleString() : ''
    ]);
    
    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Topics_Export_${exportSubject.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleAddTopicInput = () => {
    setTopicInputs([...topicInputs, { title: '', description: '' }]);
  };

  const handleRemoveTopicInput = (index: number) => {
    setTopicInputs(topicInputs.filter((_, i) => i !== index));
  };

  const handleTopicInputChange = (index: number, field: 'title' | 'description', value: string) => {
    const newInputs = [...topicInputs];
    newInputs[index][field] = value;
    setTopicInputs(newInputs);
  };

  const handleAddTopic = async (published: boolean) => {
    if (!subject.trim()) {
      showNotification('error', "Please enter a subject.");
      return;
    }
    
    const validInputs = topicInputs.filter(t => t.title.trim());
    if (validInputs.length === 0) {
      showNotification('error', "Please enter at least one topic title.");
      return;
    }
    
    setIsAdding(true);
    try {
      const batch = writeBatch(db);
      for (const input of validInputs) {
        const docRef = doc(collection(db, "topics"));
        batch.set(docRef, {
          title: input.title.trim(),
          description: input.description.trim(),
          subject: subject.trim(),
          status: 'Available',
          deadline: topicDeadline ? new Date(topicDeadline).toISOString() : null,
          topicEmail: topicEmail.trim() || null,
          published: published,
          createdAt: new Date().toISOString()
        });
      }
      await batch.commit();
      
      setSubject('');
      setTopicDeadline('');
      setTopicEmail('');
      setTopicInputs([{ title: '', description: '' }]);
      showNotification('success', published ? 'Topics published successfully!' : 'Topics saved as draft successfully!');
    } catch (error: any) {
      console.error("Error adding topics: ", error);
      showNotification('error', "Failed to add topics: " + (error?.message || error));
    } finally {
      setIsAdding(false);
    }
  };

  const handleTogglePublish = async (topicId: string, currentPublished: boolean) => {
    try {
      await updateDoc(doc(db, "topics", topicId), {
        published: !currentPublished
      });
      showNotification('success', currentPublished ? 'Moved topic to drafts.' : 'Topic published successfully!');
    } catch (error: any) {
      console.error("Error toggling publish state:", error);
      showNotification('error', "Failed to update publication status: " + (error?.message || error));
    }
  };

  const handleGenerateAiTopics = async () => {
    if (!aiPrompt.trim()) {
      showNotification('error', "প্রম্পট খালি রাখা যাবে না। অনুগ্রহ করে একটি প্রম্পট লিখুন।");
      return;
    }
    setAiLoading(true);
    setGeneratedTopics([]);
    try {
      const response = await fetch('/api/generate-topics', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          prompt: aiPrompt,
          count: aiCount,
          subject: aiSubject
        })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to generate topics.');
      }

      const data = await response.json();
      if (data.topics && data.topics.length > 0) {
        setGeneratedTopics(data.topics.map((t: any) => ({
          title: t.title || '',
          description: t.description || '',
          subject: aiSubject || 'General',
          selected: true
        })));
        showNotification('success', `AI দিয়ে ${data.topics.length}টি টপিক সফলভাবে তৈরি হয়েছে!`);
      } else {
        throw new Error('কোন টপিক তৈরি করা যায়নি। অন্য কোনো প্রম্পট দিয়ে চেষ্টা করুন।');
      }
    } catch (error: any) {
      console.error(error);
      showNotification('error', "AI টপিক জেনারেট ত্রুটি: " + (error?.message || error));
    } finally {
      setAiLoading(false);
    }
  };

  const handleSaveGeneratedTopics = async (publishImmediate: boolean) => {
    const selected = generatedTopics.filter(t => t.selected && t.title.trim());
    if (selected.length === 0) {
      showNotification('error', 'কোন টপিক সিলেক্ট করা হয়নি বা সিলেক্ট করা টপিকের টাইটেল খালি।');
      return;
    }

    setIsAdding(true);
    try {
      const batch = writeBatch(db);
      for (const t of selected) {
        const docRef = doc(collection(db, "topics"));
        batch.set(docRef, {
          title: t.title.trim(),
          description: t.description.trim(),
          subject: aiSubject.trim() || 'General',
          status: 'Available',
          deadline: topicDeadline ? new Date(topicDeadline).toISOString() : null,
          topicEmail: topicEmail.trim() || null,
          published: publishImmediate,
          createdAt: new Date().toISOString()
        });
      }
      await batch.commit();

      showNotification('success', publishImmediate ? 'AI দিয়ে তৈরি টপিকগুলো সরাসরি পাবলিশ করা হয়েছে!' : 'AI দিয়ে তৈরি টপিকগুলো ড্রাফট হিসেবে সেভ করা হয়েছে!');
      setGeneratedTopics([]);
      setAiPrompt('');
    } catch (error: any) {
      console.error("Error committing AI topics: ", error);
      showNotification('error', "টপিক সেভ করতে ব্যর্থ হয়েছে: " + (error?.message || error));
    } finally {
      setIsAdding(false);
    }
  };

  const executeResetTopic = async (topic: Topic) => {
    try {
      const batch = writeBatch(db);
      
      const topicRef = doc(db, "topics", topic.id);
      batch.update(topicRef, {
        status: 'Available',
        studentId: null,
        studentName: null,
        studentBatch: null,
        timestamp: null
      });

      if (topic.studentId) {
        const userRef = doc(db, "users", topic.studentId);
        batch.update(userRef, {
          selectedTopicId: null
        });
      }

      await batch.commit();
      showNotification('success', 'Topic selection reset successfully!');
    } catch (error: any) {
      console.error("Error resetting topic: ", error);
      showNotification('error', "Failed to reset topic: " + (error?.message || error));
    }
  };

  const handleResetTopic = async (topic: Topic) => {
    if (!topic.studentId) return;
    setConfirmModal({
      isOpen: true,
      title: 'Reset Topic Claim?',
      message: `Are you sure you want to remove ${topic.studentName || 'the student'}'s claim on this topic?`,
      onConfirm: async () => {
        await executeResetTopic(topic);
      }
    });
  };

  const executeDeleteTopic = async (topicId: string, studentId?: string) => {
    try {
      // If it's taken, we should probably reset the user's selectedTopicId first
      if (studentId) {
         const batch = writeBatch(db);
         const topicRef = doc(db, "topics", topicId);
         const userRef = doc(db, "users", studentId);
         
         batch.delete(topicRef);
         batch.update(userRef, { selectedTopicId: null });
         
         await batch.commit();
      } else {
         await deleteDoc(doc(db, "topics", topicId));
      }
      showNotification('success', 'Topic deleted successfully!');
    } catch (error: any) {
      console.error("Error deleting topic: ", error);
      showNotification('error', "Failed to delete topic: " + (error?.message || error));
    }
  };

  const handleDeleteTopic = async (topicId: string, studentId?: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Delete Topic?',
      message: 'Are you sure you want to delete this topic permanently?',
      onConfirm: async () => {
        await executeDeleteTopic(topicId, studentId);
      }
    });
  };

  if (loading) return <div className="text-center py-12 text-slate-500">Loading admin dashboard...</div>;

  const uniqueSubjects = Array.from(new Set(topics.filter(t => t.subject).map(t => t.subject)));

  const filteredTopics = selectedSubject === 'All'
    ? topics
    : topics.filter(t => t.subject === selectedSubject);

  const totalTopics = filteredTopics.length;
  const takenTopics = filteredTopics.filter(t => t.status === 'Taken').length;
  const availableTopics = totalTopics - takenTopics;
  const pendingGradingCount = topics.filter(t => t.assignmentSubmitted && !t.graded).length;

  return (
    <div className="flex flex-col gap-6 w-full">
      
      {/* Tabs Navigation */}
      <div className="flex bg-white rounded-2xl shadow-sm border border-slate-200 p-1 flex-wrap md:flex-nowrap gap-1">
        <button
          onClick={() => setActiveTab('topics')}
          className={`flex-1 py-3 px-4 rounded-xl flex items-center justify-center gap-2 font-bold text-sm transition-all ${activeTab === 'topics' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}
        >
          <BookOpen className="w-5 h-5" /> Manage Topics
        </button>
        <button
          onClick={() => setActiveTab('submissions')}
          className={`flex-1 py-3 px-4 rounded-xl flex items-center justify-center gap-2 font-bold text-sm transition-all relative ${activeTab === 'submissions' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}
        >
          <ClipboardCheck className="w-5 h-5" /> Submissions
          {pendingGradingCount > 0 && (
            <span className="bg-rose-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold min-w-[18px] text-center">
              {pendingGradingCount}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('users')}
          className={`flex-1 py-3 px-4 rounded-xl flex items-center justify-center gap-2 font-bold text-sm transition-all ${activeTab === 'users' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}
        >
          <Users className="w-5 h-5" /> Users & Permissions
        </button>
        <button
          onClick={() => setActiveTab('settings')}
          className={`flex-1 py-3 px-4 rounded-xl flex items-center justify-center gap-2 font-bold text-sm transition-all ${activeTab === 'settings' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}
        >
          <Settings className="w-5 h-5" /> Settings
        </button>
      </div>

      {activeTab === 'topics' && (
        <>
          {/* Subject Filter Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-3xl border border-slate-200 shadow-sm animate-fade-in">
            <div>
              <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Dashboard Overview</h2>
              <p className="text-xs text-slate-500">Filter overall statistics and topic list by selecting a subject</p>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider shrink-0">Filter Subject:</label>
              <select
                value={selectedSubject}
                onChange={(e) => setSelectedSubject(e.target.value)}
                className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm font-medium text-slate-700 min-w-[200px]"
              >
                <option value="All">All Subjects ({topics.length})</option>
                {uniqueSubjects.map((subj, idx) => {
                  const count = topics.filter(t => t.subject === subj).length;
                  return (
                    <option key={idx} value={subj as string}>
                      {subj as string} ({count})
                    </option>
                  );
                })}
              </select>
            </div>
          </div>

          {/* Stats Panel */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white p-5 rounded-3xl border border-slate-200 flex flex-col justify-center shadow-sm transition-shadow hover:shadow-md">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Total Topics</p>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-slate-900">{totalTopics}</span>
                <span className="text-sm text-slate-400 font-medium">Uploaded</span>
              </div>
            </div>
            <div className="bg-teal-50 p-5 rounded-3xl border border-teal-100 flex flex-col justify-center shadow-sm transition-shadow hover:shadow-md">
              <p className="text-xs font-bold text-teal-600 uppercase tracking-wider mb-1">Available</p>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-teal-700">{availableTopics}</span>
                <span className="text-sm text-teal-600 font-medium">Remaining</span>
              </div>
            </div>
            <div className="bg-rose-50 p-5 rounded-3xl border border-rose-100 flex flex-col justify-center shadow-sm transition-shadow hover:shadow-md">
              <p className="text-xs font-bold text-rose-600 uppercase tracking-wider mb-1">Locked / Taken</p>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-rose-700">{takenTopics}</span>
                <span className="text-sm text-rose-600 font-medium">
                  {totalTopics > 0 ? ((takenTopics / totalTopics) * 100).toFixed(1) : 0}% Fill Rate
                </span>
              </div>
            </div>
            <div className="bg-white p-5 rounded-3xl border border-slate-200 flex flex-col justify-center shadow-sm transition-shadow hover:shadow-md">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Active Students</p>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-slate-900">
                  {usersList.filter(u => u.role !== 'admin').length}
                </span>
                <span className="text-sm text-slate-400 font-medium">Enrolled</span>
              </div>
            </div>
          </div>
        </>
      )}

      {activeTab === 'topics' ? (
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1">
        
        {/* Left Column: Topic List */}
        <div className="lg:col-span-8 bg-white rounded-3xl border border-slate-200 flex flex-col overflow-hidden shadow-sm">
          <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white">
            <h2 className="text-lg font-bold flex items-center gap-2 text-slate-800">
               Research Topic Inventory {selectedSubject !== 'All' && `— ${selectedSubject}`}
            </h2>
          </div>
          
          <div className="p-0 overflow-y-auto max-h-[600px]">
            {filteredTopics.length === 0 ? (
              <div className="p-8 text-center text-slate-500">No topics found matching current selection.</div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {filteredTopics.map(topic => (
                  <li key={topic.id} className="p-5 hover:bg-slate-50 transition-colors">
                    <div className="flex justify-between items-start gap-4">
                      <div>
                        {topic.subject && (
                          <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">
                            {topic.subject}
                          </div>
                        )}
                        <h3 className="font-semibold text-slate-800 mb-1">{topic.title}</h3>
                        <p className="text-sm text-slate-600 mb-3">{topic.description}</p>
                        
                        {topic.status === 'Taken' ? (
                          <div className="flex flex-wrap gap-2">
                            <div className="inline-flex items-center gap-1.5 text-rose-600 font-bold text-xs bg-rose-50 px-2.5 py-1 rounded-md border border-rose-100">
                              <span className="w-2 h-2 rounded-full bg-rose-600 animate-pulse"></span> LOCKED: 
                              <span className="font-semibold text-slate-600 ml-1">{topic.studentName} {topic.studentBatch ? `(${topic.studentBatch})` : ''}</span>
                              {topic.timestamp && <span className="text-slate-400 font-medium ml-1"> - {format(new Date(topic.timestamp), 'MMM d, h:mm a')}</span>}
                            </div>
                            {topic.deadline && (
                              <div className="inline-flex items-center gap-1.5 text-slate-600 font-bold text-[11px] bg-slate-50 px-2.5 py-1 rounded-md border border-slate-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                                DEADLINE: {format(new Date(topic.deadline), 'MMM d, h:mm a')}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            <div className="inline-flex items-center gap-1.5 text-teal-600 font-bold text-xs bg-teal-50 px-2.5 py-1 rounded-md border border-teal-100">
                              <span className="w-2 h-2 rounded-full bg-teal-600"></span> AVAILABLE
                            </div>
                            {topic.deadline && (
                              <div className="inline-flex items-center gap-1.5 text-slate-600 font-bold text-[11px] bg-slate-50 px-2.5 py-1 rounded-md border border-slate-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                                DEADLINE: {format(new Date(topic.deadline), 'MMM d, h:mm a')}
                              </div>
                            )}
                          </div>
                        )}

                        <div className="flex flex-wrap gap-2 mt-2">
                          {topic.published === false ? (
                            <span className="inline-flex items-center gap-1 text-amber-600 font-bold text-[10px] bg-amber-50 px-2 py-0.5 rounded-md border border-amber-100 uppercase tracking-wider">
                              Draft
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-teal-600 font-bold text-[10px] bg-teal-50 px-2 py-0.5 rounded-md border border-teal-100 uppercase tracking-wider">
                              Published
                            </span>
                          )}
                          {topic.topicEmail && (
                            <span className="inline-flex items-center gap-1 text-slate-500 font-semibold text-[10px] bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                              Mail: {topic.topicEmail}
                            </span>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2 shrink-0">
                        {topic.published === false ? (
                          <button 
                            onClick={() => handleTogglePublish(topic.id, false)}
                            className="p-2 text-amber-500 hover:bg-amber-50 rounded-xl transition-colors border border-transparent hover:border-amber-200"
                            title="Publish Topic (Make Visible to Students)"
                          >
                            <EyeOff className="w-4 h-4" />
                          </button>
                        ) : (
                          <button 
                            onClick={() => handleTogglePublish(topic.id, true)}
                            className="p-2 text-teal-600 hover:bg-teal-50 rounded-xl transition-colors border border-transparent hover:border-teal-200"
                            title="Move to Draft (Hide from Students)"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        )}
                        {topic.status === 'Taken' && (
                          <button 
                            onClick={() => handleResetTopic(topic)}
                            className="p-2 text-amber-500 hover:bg-amber-50 rounded-xl transition-colors group relative border border-transparent hover:border-amber-200"
                            title="Reset Topic (Remove Claim)"
                          >
                            <RotateCcw className="w-4 h-4" />
                          </button>
                        )}
                        <button 
                          onClick={() => handleDeleteTopic(topic.id, topic.studentId)}
                          className="p-2 text-rose-500 hover:bg-rose-50 rounded-xl transition-colors border border-transparent hover:border-rose-200"
                          title="Delete Topic"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Right Column: Add Topic Form in Dark Bento Style */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          {/* AI Topic Generator Card */}
          <div className="bg-slate-900 rounded-3xl p-6 text-white flex flex-col gap-4 shadow-xl border border-slate-800/85 relative overflow-hidden">
            {/* Background glowing aura */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-teal-500/10 rounded-full blur-3xl pointer-events-none"></div>
            
            <div className="flex items-center gap-2.5">
              <div className="bg-teal-500/10 p-2 rounded-xl border border-teal-500/20">
                <Sparkles className="w-5 h-5 text-teal-400 animate-pulse" />
              </div>
              <div>
                <h2 className="text-md font-bold text-white flex items-center gap-2">
                  AI Topic Generator <span className="text-[10px] bg-teal-500/20 text-teal-300 px-1.5 py-0.5 rounded font-mono">GEMINI AI</span>
                </h2>
                <p className="text-[11px] text-slate-400 font-medium">সহজে এবং দ্রুত প্রম্পট দিয়ে গবেষণা টপিক তৈরি করুন</p>
              </div>
            </div>

            {generatedTopics.length === 0 ? (
              <div className="space-y-4 pt-2">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">What is the topic about? (কী বিষয়ে টপিক তৈরি করবেন?)</label>
                  <textarea 
                    rows={3}
                    placeholder="যেমনঃ 'React JS এর মৌলিক বিষয়ের উপর ৫টি গবেষণা প্রস্তাবনা' অথবা '১০টি আধুনিক সমাজবিজ্ঞান ও ইসলামী চিন্তাধারার উপর গবেষণাধর্মী টপিক'..."
                    className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-2xl focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-transparent text-xs placeholder:text-slate-500 text-white transition-all resize-none shadow-inner"
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 font-sans">Subject / Category</label>
                    <input 
                      type="text" 
                      placeholder="e.g. Science, Hadith"
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/50 text-xs text-white"
                      value={aiSubject}
                      onChange={(e) => setAiSubject(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 font-sans">How Many</label>
                    <input
                      type="number"
                      min="1"
                      max="20"
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/50 text-xs text-white"
                      value={aiCount}
                      onChange={(e) => setAiCount(Math.min(20, Math.max(1, parseInt(e.target.value) || 1)))}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 font-sans">Deadline (Optional)</label>
                        <input
                            type="datetime-local"
                            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/50 text-xs text-white"
                            style={{ colorScheme: 'dark' }}
                            value={topicDeadline}
                            onChange={(e) => setTopicDeadline(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 font-sans">Notification Email (Optional)</label>
                        <input
                            type="email"
                            placeholder="e.g. email@domain.com"
                            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/50 text-xs text-white"
                            value={topicEmail}
                            onChange={(e) => setTopicEmail(e.target.value)}
                        />
                    </div>
                </div>

                <button
                  type="button"
                  disabled={aiLoading}
                  onClick={handleGenerateAiTopics}
                  className="w-full py-3 bg-teal-600 hover:bg-teal-500 text-white font-bold rounded-2xl text-xs uppercase tracking-widest transition-all disabled:opacity-50 flex items-center justify-center gap-2 mt-2 cursor-pointer shadow-md shadow-teal-900/30"
                >
                  {aiLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                      <span>Generating Topics...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5 text-teal-200" />
                      <span>AI দিয়ে টপিক জেনারেট করুন</span>
                    </>
                  )}
                </button>
              </div>
            ) : (
              <div className="space-y-4 pt-1">
                <div className="flex justify-between items-center bg-slate-850 p-2 rounded-xl border border-slate-800">
                  <span className="text-xs font-bold text-teal-300">Generated Drafts ({generatedTopics.length})</span>
                  <button 
                    onClick={() => setGeneratedTopics([])}
                    className="text-[10px] text-slate-400 hover:text-white transition-colors underline"
                  >
                    Reset & Start Over
                  </button>
                </div>

                <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                  {generatedTopics.map((topic, idx) => (
                    <div key={idx} className="bg-slate-800/80 p-3 rounded-2xl border border-slate-700/60 flex gap-2.5 items-start">
                      <input 
                        type="checkbox" 
                        className="mt-1 accent-teal-500 cursor-pointer h-4 w-4 rounded border-slate-600"
                        checked={topic.selected}
                        onChange={(e) => {
                          const updated = [...generatedTopics];
                          updated[idx].selected = e.target.checked;
                          setGeneratedTopics(updated);
                        }}
                      />
                      <div className="flex-1 space-y-1.5">
                        <input 
                          type="text"
                          className="w-full bg-slate-900 px-2 py-1 text-xs text-white rounded border border-slate-700 focus:outline-none focus:ring-1 focus:ring-teal-500 font-bold"
                          value={topic.title}
                          onChange={(e) => {
                            const updated = [...generatedTopics];
                            updated[idx].title = e.target.value;
                            setGeneratedTopics(updated);
                          }}
                        />
                        <textarea 
                          rows={2}
                          className="w-full bg-slate-900 px-2 py-1 text-[11px] text-slate-300 rounded border border-slate-700 focus:outline-none focus:ring-1 focus:ring-teal-500 resize-none leading-relaxed"
                          value={topic.description}
                          onChange={(e) => {
                            const updated = [...generatedTopics];
                            updated[idx].description = e.target.value;
                            setGeneratedTopics(updated);
                          }}
                        />
                        <div className="flex justify-between items-center text-[10px] text-slate-500">
                          <span>Subject Category:</span>
                          <input 
                            type="text"
                            className="bg-transparent text-right text-teal-400 font-bold max-w-[120px] focus:outline-none uppercase text-[9px]"
                            value={topic.subject}
                            onChange={(e) => {
                              const updated = [...generatedTopics];
                              updated[idx].subject = e.target.value;
                              setGeneratedTopics(updated);
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2">
                  <button
                    type="button"
                    disabled={isAdding}
                    onClick={() => handleSaveGeneratedTopics(false)}
                    className="py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-[10px] uppercase tracking-wider transition-all border border-slate-700 cursor-pointer"
                  >
                    Save as Draft
                  </button>
                  <button
                    type="button"
                    disabled={isAdding}
                    onClick={() => handleSaveGeneratedTopics(true)}
                    className="py-2.5 bg-teal-600 hover:bg-teal-500 text-white font-bold rounded-xl text-[10px] uppercase tracking-wider transition-all shadow-md shadow-teal-900/30 cursor-pointer"
                  >
                    {isAdding ? 'Saving...' : 'Publish Live'}
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="bg-slate-900 rounded-3xl p-6 text-white flex flex-col justify-between shadow-sm border border-slate-800">
            <div className="mb-6">
              <h2 className="text-lg font-bold mb-1 text-white">Add New Topic (Manual)</h2>
              <p className="text-xs text-slate-400">Management overrides and system control</p>
            </div>
            
            <form onSubmit={(e) => { e.preventDefault(); }} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Subject / Category</label>
                <input 
                  type="text" 
                  placeholder="e.g. History or Science"
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-2xl focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm placeholder:text-slate-500 text-white transition-all shadow-inner"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Submission Deadline (Optional)</label>
                <input 
                  type="datetime-local" 
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-2xl focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm text-white transition-all shadow-inner font-medium h-11"
                  style={{ colorScheme: 'dark' }}
                  value={topicDeadline}
                  onChange={(e) => setTopicDeadline(e.target.value)}
                />
                <p className="text-[10px] text-slate-500 mt-1">Specify the global submission date and time for topics under this subject.</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Notification Email for Topics (Optional)</label>
                <input 
                  type="email" 
                  placeholder="e.g. supervisor@domain.com"
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-2xl focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm placeholder:text-slate-500 text-white transition-all shadow-inner"
                  value={topicEmail}
                  onChange={(e) => setTopicEmail(e.target.value)}
                />
                <p className="text-[10px] text-slate-500 mt-1">Updates for claims of these topics are sent to this address. Falls back to global/subject emails if left blank.</p>
              </div>

              <div className="space-y-4">
                {topicInputs.map((input, index) => (
                  <div key={index} className="bg-slate-800/50 p-4 rounded-2xl border border-slate-700/50 space-y-3 relative group">
                    {topicInputs.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveTopicInput(index)}
                        className="absolute -top-2 -right-2 bg-rose-500 text-white p-1.5 rounded-full hover:bg-rose-400 transition-colors opacity-0 group-hover:opacity-100 shadow-md"
                        title="Remove"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Title</label>
                      <input 
                        type="text" 
                        required={index === 0}
                        placeholder="e.g. History of Algebra"
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm placeholder:text-slate-600 text-white transition-all"
                        value={input.title}
                        onChange={(e) => handleTopicInputChange(index, 'title', e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Description (Optional)</label>
                      <textarea 
                        rows={2}
                        placeholder="Details..."
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm resize-none placeholder:text-slate-600 text-white transition-all"
                        value={input.description}
                        onChange={(e) => handleTopicInputChange(index, 'description', e.target.value)}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={handleAddTopicInput}
                className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-teal-400 font-bold rounded-2xl text-xs uppercase tracking-widest transition-all border border-dashed border-slate-600 flex items-center justify-center gap-2"
              >
                <Plus className="w-3 h-3" /> Add Another Topic to Subject
              </button>

              <div className="flex gap-3 mt-4">
                <button 
                  type="button" 
                  disabled={isAdding}
                  onClick={() => handleAddTopic(false)}
                  className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-2xl text-xs uppercase tracking-widest transition-all disabled:opacity-70 border border-slate-700 flex items-center justify-center gap-2"
                >
                  Save as Draft
                </button>
                <button 
                  type="button" 
                  disabled={isAdding}
                  onClick={() => handleAddTopic(true)}
                  className="flex-1 py-3 bg-teal-600 hover:bg-teal-500 text-white font-bold rounded-2xl text-xs uppercase tracking-widest transition-all disabled:opacity-70 shadow-sm shadow-teal-900/50 flex items-center justify-center gap-2"
                >
                  {isAdding ? 'Saving...' : 'Publish'}
                </button>
              </div>
            </form>

            <div className="mt-6 pt-6 border-t border-slate-800">
               <div className="bg-slate-800/50 border border-slate-700/50 p-4 rounded-2xl flex flex-col gap-3 text-slate-300 text-sm shrink-0 mb-4">
                 <div className="flex gap-3">
                   <AlertTriangle className="w-5 h-5 shrink-0 text-amber-500 mt-0.5" />
                   <p className="leading-relaxed text-xs">
                     <strong className="text-white block mb-1">Administrator Notice:</strong> 
                     You can add topics, drop claims, or remove topics entirely.
                   </p>
                 </div>
               </div>
               
               <div className="flex flex-col gap-3">
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Export by Subject</label>
                  <select
                     value={exportSubject}
                     onChange={(e) => setExportSubject(e.target.value)}
                     className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-2xl focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm text-white transition-all shadow-inner appearance-none"
                  >
                     <option value="All">All Subjects</option>
                     {Array.from(new Set(topics.filter(t => t.subject).map(t => t.subject))).map((subj, idx) => (
                        <option key={idx} value={subj}>{subj}</option>
                     ))}
                  </select>
                  <button 
                    type="button"
                    onClick={handleExportCSV}
                    className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-2xl text-xs uppercase tracking-widest transition-all shadow-sm flex items-center justify-center gap-2"
                  >
                    <Download className="w-4 h-4" /> Download Selected (CSV)
                  </button>
               </div>
            </div>
          </div>
        </div>

      </div>
      ) : activeTab === 'submissions' ? (
        <SubmissionsView topics={topics} />
      ) : activeTab === 'users' ? (
        <div className="bg-white rounded-3xl border border-slate-200 flex flex-col overflow-hidden shadow-sm flex-1">
          <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white">
            <h2 className="text-lg font-bold flex items-center gap-2 text-slate-800">
              <Shield className="w-5 h-5 text-teal-600" /> Administrative Permissions
            </h2>
          </div>
          <div className="p-0 overflow-y-auto max-h-[600px]">
            <ul className="divide-y divide-slate-100">
              {usersList.map(u => (
                <li key={u.id} className="p-5 hover:bg-slate-50 transition-colors flex justify-between items-center">
                   <div>
                     <p className="font-bold text-slate-800">{u.name || 'Unknown'}</p>
                     <p className="text-sm text-slate-500">{u.email} • Batch: {u.batch || 'N/A'}</p>
                   </div>
                   <div className="flex items-center gap-4">
                     <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${u.role === 'admin' ? 'bg-teal-100 text-teal-700' : 'bg-slate-100 text-slate-600'}`}>
                       {u.role}
                     </span>
                     <button 
                       onClick={() => handleToggleRole(u.id, u.role)}
                       className={`p-2 rounded-xl border transition-all ${u.role === 'admin' ? 'border-amber-200 text-amber-600 hover:bg-amber-50' : 'border-teal-200 text-teal-600 hover:bg-teal-50'}`}
                       title={u.role === 'admin' ? "Revoke Admin Access" : "Make Administrator"}
                     >
                       <UserCheck className="w-4 h-4" />
                     </button>
                   </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-slate-200 flex flex-col overflow-hidden shadow-sm flex-1">
          <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white">
            <h2 className="text-lg font-bold flex items-center gap-2 text-slate-800">
              <Settings className="w-5 h-5 text-teal-600" /> General Settings
            </h2>
          </div>
          <div className="p-6 overflow-y-auto max-h-[600px] max-w-2xl">
             <form onSubmit={handleSaveSettings} className="space-y-6">
               <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Application Name</label>
                  <p className="text-xs text-slate-500 mb-2 font-medium">The main title name/brand displayed in the header across all screens.</p>
                  <input
                    type="text"
                    required
                    value={appName}
                    onChange={(e) => setAppName(e.target.value)}
                    placeholder="e.g. As-Sunnah Dawah & Research Institute"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm font-semibold text-slate-800"
                  />
               </div>

               <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Application Subtitle</label>
                  <p className="text-xs text-slate-500 mb-2 font-medium">A supporting tagline or department name displayed below the main title.</p>
                  <input
                    type="text"
                    value={appSubtitle}
                    onChange={(e) => setAppSubtitle(e.target.value)}
                    placeholder="e.g. Topic Selection & Locking System"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm font-medium text-slate-700"
                  />
               </div>

               <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Assignment Submission Email</label>
                  <p className="text-xs text-slate-500 mb-2">The email address where student assignment files will be sent. If left blank, it falls back to the server environment config.</p>
                  <input
                    type="email"
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    placeholder="e.g. head_teacher@madrasah.com"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm"
                  />
               </div>

               <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Subject-specific Emails</label>
                  <p className="text-xs text-slate-500 mb-4">Set specific emails to receive updates for particular subjects. The default email above is used if no email is set here.</p>
                  
                  <div className="space-y-3">
                     {Array.from(new Set(topics.filter(t => t.subject).map(t => t.subject))).map((subj, idx) => (
                       <div key={idx} className="flex flex-col sm:flex-row sm:items-center gap-2">
                         <div className="w-full sm:w-1/3 flex items-center gap-2">
                           <span className="text-sm font-medium text-slate-700 px-3 py-2 bg-slate-100 rounded-lg w-full truncate">{subj}</span>
                         </div>
                         <input
                           type="email"
                           value={subjectEmails[subj as string] || ''}
                           onChange={(e) => setSubjectEmails(prev => ({ ...prev, [subj as string]: e.target.value }))}
                           placeholder="Override email for this subject..."
                           className="flex-1 px-4 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm"
                         />
                       </div>
                     ))}
                     {Array.from(new Set(topics.filter(t => t.subject).map(t => t.subject))).length === 0 && (
                       <div className="text-sm text-slate-500 italic">No subjects available yet. Add subjects and topics first.</div>
                     )}
                  </div>
               </div>

               <button 
                 type="submit" 
                 disabled={isSavingSettings}
                 className="py-3 px-6 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl text-xs uppercase tracking-widest transition-all shadow-sm"
               >
                 {isSavingSettings ? 'Saving...' : 'Save Settings'}
               </button>
             </form>
          </div>
        </div>
      )}
       {/* Custom State-Driven Confirmation Dialog */}
       {confirmModal?.isOpen && (
         <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/65 backdrop-blur-sm animate-fade-in animate-duration-200">
           <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xl max-w-sm w-full mx-4 space-y-4">
             <div className="flex items-start gap-3">
               <AlertTriangle className="w-6 h-6 shrink-0 text-amber-500 mt-0.5 animate-bounce" />
               <div>
                 <h3 className="text-base font-bold text-slate-900">{confirmModal.title}</h3>
                 <p className="text-sm text-slate-500 leading-normal mt-1">{confirmModal.message}</p>
               </div>
             </div>
             <div className="flex gap-3 justify-end pt-2">
               <button
                 type="button"
                 onClick={() => setConfirmModal(null)}
                 className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs uppercase tracking-wider transition-colors"
               >
                 Cancel
               </button>
               <button
                 type="button"
                 onClick={async () => {
                   const action = confirmModal.onConfirm;
                   setConfirmModal(null);
                   await action();
                 }}
                 className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition-colors shadow-sm"
               >
                 Confirm
               </button>
             </div>
           </div>
         </div>
       )}

       {/* Custom Floating Toast Alert Notifications */}
       {panelNotification && (
         <div className="fixed bottom-6 right-6 z-[9999] max-w-sm w-full mx-4 animate-slide-in">
           <div className={`p-4 rounded-2xl shadow-lg border flex items-center gap-3 ${
             panelNotification.type === 'success' 
               ? 'bg-teal-50 text-teal-800 border-teal-200 shadow-teal-50' 
               : 'bg-rose-50 text-rose-800 border-rose-200 shadow-rose-50'
           }`}>
             <div className="flex-1 text-xs font-bold leading-normal">{panelNotification.message}</div>
             <button 
               type="button" 
               onClick={() => setPanelNotification(null)}
               className="text-[10px] font-bold uppercase tracking-wider text-slate-400 hover:text-slate-600 border border-slate-200 bg-white hover:bg-slate-50 px-2 py-1 rounded-lg shrink-0"
             >
               Close
             </button>
           </div>
         </div>
       )}
    </div>
  );
}
