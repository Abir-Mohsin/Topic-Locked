import React, { useState, useEffect, useRef } from 'react';
import { collection, query, onSnapshot, doc, runTransaction, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { CheckCircle2, Lock, Unlock, Search, UploadCloud, FileText, Award } from 'lucide-react';
import { format } from 'date-fns';

interface Topic {
  id: string;
  title: string;
  description: string;
  status: 'Available' | 'Taken';
  subject?: string;
  studentId?: string;
  studentName?: string;
  studentBatch?: string;
  studentEmail?: string;
  timestamp?: string;
  deadline?: string;
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

interface SelectedTopicCardProps {
  key?: any;
  topic: Topic;
  globalSettings: any;
  user: any;
  studentName: string | null;
  studentBatch: string | null;
}

const SelectedTopicCard = ({ topic, globalSettings, user, studentName, studentBatch }: SelectedTopicCardProps) => {
  const [timeLeft, setTimeLeft] = useState<string>('');
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState({ type: '', text: '' });
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!topic.timestamp && !topic.deadline) return;
    const deadlineDays = globalSettings?.deadlineDays || 2;

    const updateTime = () => {
      let deadlineTime: number;
      if (topic.deadline) {
        deadlineTime = new Date(topic.deadline).getTime();
      } else if (topic.timestamp) {
        const selectedTime = new Date(topic.timestamp).getTime();
        deadlineTime = selectedTime + (deadlineDays * 24 * 60 * 60 * 1000);
      } else {
        setTimeLeft('N/A');
        return true;
      }

      const now = new Date().getTime();
      const diff = deadlineTime - now;

      if (diff <= 0) {
        setTimeLeft('Expired');
        return true;
      } else {
        const d = Math.floor(diff / (1000 * 60 * 60 * 24));
        const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const s = Math.floor((diff % (1000 * 60)) / 1000);
        setTimeLeft(`${d}d ${h}h ${m}m ${s}s left`);
        return false;
      }
    };

    if (updateTime()) return;

    const interval = setInterval(() => {
      if (updateTime()) clearInterval(interval);
    }, 1000);

    return () => clearInterval(interval);
  }, [topic, globalSettings]);

  const handleUploadAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !user) return;

    setUploading(true);
    setUploadMessage({ type: '', text: '' });

    const finalStudentName = studentName || topic.studentName || 'Unknown Student';
    const finalStudentBatch = studentBatch || topic.studentBatch || 'Unknown Batch';
    const finalStudentEmail = user.email || topic.studentEmail || 'Unknown Email';

    const formData = new FormData();
    formData.append('file', file);
    formData.append('studentName', finalStudentName);
    formData.append('studentEmail', finalStudentEmail);
    formData.append('studentBatch', finalStudentBatch);
    formData.append('topicTitle', topic.title);
    formData.append('topicId', topic.id);
    formData.append('message', message);
    
    // Determine the target email based on topic email first, then subject overriding, then global admin email
    let targetEmail = topic.topicEmail || '';
    if (!targetEmail && topic.subject && globalSettings?.subjectEmails && globalSettings.subjectEmails[topic.subject]) {
      targetEmail = globalSettings.subjectEmails[topic.subject];
    }
    if (!targetEmail) {
      targetEmail = globalSettings?.adminEmail || '';
    }
    if (targetEmail) {
      formData.append('targetAdminEmail', targetEmail);
    }

    try {
      const res = await fetch('/api/submit-assignment', {
        method: 'POST',
        body: formData,
      });

      let data;
      const contentType = res.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        data = await res.json();
      } else {
        const text = await res.text();
        const shortText = text.substring(0, 100).replace(/\n/g, ' ');
        console.error('Non-JSON Response from server:', res.status, res.statusText, text.substring(0, 300));
        throw new Error(`সার্ভার থেকে সঠিক রেসপন্স পাওয়া যায়নি (Status: ${res.status} ${res.statusText}). Error: ${shortText}`);
      }

      if (!res.ok) {
        throw new Error(data?.error || 'Upload failed');
      }

      // Save submission state to firestore
      const topicRef = doc(db, 'topics', topic.id);
      await updateDoc(topicRef, {
        assignmentSubmitted: true,
        submissionMessage: message || '',
        submissionTimestamp: new Date().toISOString(),
        submittedFileName: file?.name || 'assignment.pdf',
        studentId: user.uid,
        studentName: finalStudentName,
        studentBatch: finalStudentBatch,
        studentEmail: finalStudentEmail,
        graded: false,
        grade: null,
        gradeOutOf: null,
        gradedAt: null,
        gradeMessage: null
      });

      setUploadMessage({ type: 'success', text: 'Assignment submitted successfully! Admin will see it and receive it via email.' });
      setFile(null);
      setMessage('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err: any) {
      setUploadMessage({ type: 'error', text: err.message || 'Failed to upload assignment' });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="bg-teal-50 border border-teal-200 rounded-3xl p-6 shadow-sm relative overflow-hidden transition-all flex flex-col md:flex-row gap-8 mb-6">
      <div className="absolute top-0 right-0 p-6 pointer-events-none opacity-10">
        <CheckCircle2 className="w-32 h-32 text-teal-600" />
      </div>
      
      <div className="flex-1 flex items-start gap-4 relative z-10">
        <div className="bg-teal-100 p-3 rounded-2xl shrink-0 mt-1">
          <CheckCircle2 className="w-6 h-6 text-teal-600" />
        </div>
        <div>
          <h2 className="text-xs font-bold text-teal-600 uppercase tracking-widest mb-1">Your Selected Topic {topic.subject && `— ${topic.subject}`}</h2>
          <p className="text-teal-900 font-bold text-xl mb-2">{topic.title}</p>
          <p className="text-teal-700/80 text-sm mb-4 max-w-3xl">{topic.description}</p>
          <div className="flex flex-wrap gap-2 mb-2">
            <div className="text-xs font-bold uppercase tracking-wider text-teal-700 bg-teal-100/50 px-3 py-1.5 rounded-lg inline-block border border-teal-200">
              Selected on: {topic.timestamp ? format(new Date(topic.timestamp), 'PPP p') : 'Unknown time'}
            </div>
            {topic.deadline && (
              <div className="text-xs font-bold uppercase tracking-wider text-teal-700 bg-teal-100/30 px-3 py-1.5 rounded-lg inline-block border border-teal-200">
                Deadline Date: {format(new Date(topic.deadline), 'PPP p')}
              </div>
            )}
            <div className={`text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-lg inline-flex items-center gap-2 border ${timeLeft === 'Expired' ? 'bg-rose-100 text-rose-700 border-rose-200' : 'bg-amber-100 text-amber-700 border-amber-200'}`}>
              Time Left: {timeLeft || 'Calculating...'}
            </div>
          </div>
        </div>
      </div>

      <div className="w-full md:w-96 shrink-0 bg-white rounded-2xl p-5 border border-teal-100 shadow-sm relative z-10 flex flex-col gap-4">
         {topic.assignmentSubmitted ? (
           <div className="space-y-4">
             <div className="flex justify-between items-center bg-teal-50 border border-teal-100 rounded-xl p-3.5">
               <div className="flex items-center gap-2">
                 <div className="w-2.5 h-2.5 bg-teal-500 rounded-full animate-pulse" />
                 <span className="text-xs font-bold text-teal-800 uppercase tracking-wide">Assignment Submitted</span>
               </div>
               <span className="text-[10px] text-slate-400 font-medium font-mono">
                 {topic.submissionTimestamp ? format(new Date(topic.submissionTimestamp), 'MMM dd, HH:mm') : ''}
               </span>
             </div>

             {/* Grades/Marks Area */}
             {topic.graded ? (
               <div className="bg-amber-50/60 border border-amber-200/80 rounded-2xl p-4 flex flex-col gap-2">
                 <div className="flex items-center gap-2">
                   <Award className="w-5 h-5 text-amber-600 shrink-0" />
                   <h4 className="text-xs font-extrabold text-amber-800 uppercase tracking-widest">Marking & Faculty Grade</h4>
                 </div>
                 <div className="mt-1 flex items-baseline gap-1.5">
                   <span className="text-3xl font-black text-amber-900 tracking-tight">{topic.grade}</span>
                   <span className="text-xs font-bold text-slate-500">out of</span>
                   <span className="text-base font-extrabold text-slate-700">{topic.gradeOutOf}</span>
                 </div>
                 {topic.gradeMessage && (
                   <div className="mt-2 text-xs text-slate-700 bg-white/70 border border-amber-100 rounded-xl p-2.5 italic">
                     "{topic.gradeMessage}"
                   </div>
                 )}
               </div>
             ) : (
               <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex items-center gap-3">
                 <div className="w-10 h-10 bg-slate-200/60 rounded-xl flex items-center justify-center text-slate-500 shrink-0">
                   <FileText className="w-5 h-5" />
                 </div>
                 <div>
                   <h4 className="text-xs font-bold text-slate-700">Pending Evaluation</h4>
                   <p className="text-[10px] text-slate-500 mt-0.5">Faculty is reviewing your submission.</p>
                 </div>
               </div>
             )}

             {/* File Info */}
             <div className="text-xs bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-col gap-1">
               <div className="flex justify-between items-center">
                 <span className="font-bold text-slate-600 block truncate max-w-[200px]" title={topic.submittedFileName}>
                   📂 {topic.submittedFileName || 'assignment.pdf'}
                 </span>
               </div>
               {topic.submissionMessage && (
                 <p className="text-[11px] text-slate-500 mt-1 line-clamp-2 border-t border-slate-200/60 pt-1.5">
                   <strong>Message:</strong> {topic.submissionMessage}
                 </p>
               )}
             </div>

             {/* Re-submission Form Toggle */}
             {false && (
               <button
                 type="button"
                 onClick={async () => {
                   try {
                     const topicRef = doc(db, 'topics', topic.id);
                     await updateDoc(topicRef, {
                        assignmentSubmitted: false
                     });
                   } catch (err) {
                     console.error(err);
                   }
                 }}
                 className="w-full py-2 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-xl text-slate-600 font-bold text-[11px] uppercase tracking-wide transition-colors"
               >
                 🔄 Submit Alternative Version
               </button>
             )}
           </div>
         ) : (
           <>
             <h3 className="text-sm font-bold text-slate-800 mb-1 flex items-center gap-2">
               <FileText className="w-4 h-4 text-teal-600" /> Submit Assignment
             </h3>
             <p className="text-[10px] text-slate-400 font-medium mb-2">Upload your assignment file (.pdf, .doc, .docx only) below.</p>
             {timeLeft === 'Expired' ? (
                <div className="bg-rose-50 border border-rose-100 p-4 rounded-xl text-center">
                  <p className="text-sm font-bold text-rose-700">Deadline Expired</p>
                  <p className="text-xs text-rose-600 mt-1">You can no longer submit the assignment for this topic.</p>
                </div>
             ) : (
             <form onSubmit={handleUploadAssignment} className="flex flex-col gap-3">
               <div>
                 <textarea
                   value={message}
                   onChange={e => setMessage(e.target.value)}
                   placeholder="Any message for admin? (Optional)"
                   className="w-full text-sm p-3 border border-slate-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-teal-500 transition-all bg-slate-50 text-slate-700 font-medium"
                   rows={2}
                 />
               </div>
               <div className="relative">
                 <input 
                   type="file" 
                   ref={fileInputRef}
                   onChange={(e) => setFile(e.target.files ? e.target.files[0] : null)}
                   accept=".pdf,.doc,.docx"
                   required
                   className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:uppercase file:tracking-wider file:bg-teal-50 file:text-teal-700 hover:file:bg-teal-100 transition-all"
                 />
               </div>
               <button 
                 type="submit" 
                 disabled={!file || uploading}
                 className="mt-2 w-full py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl text-xs uppercase tracking-widest transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm flex justify-center items-center gap-2"
               >
                 {uploading ? 'Uploading...' : <><UploadCloud className="w-4 h-4" /> Upload & Send to Admin</>}
               </button>
               
               {uploadMessage.text && (
                 <p className={`text-xs font-semibold mt-1 p-2.5 rounded-xl border flex items-center gap-2 ${
                   uploadMessage.type === 'error' 
                     ? 'text-rose-700 bg-rose-50 border-rose-100' 
                     : 'text-teal-700 bg-teal-50 border-teal-100'
                 }`}>
                   <span className="shrink-0">{uploadMessage.type === 'error' ? '⚠️' : '✅'}</span>
                   <span className="flex-1">{uploadMessage.text}</span>
                 </p>
               )}
             </form>
             )}
           </>
         )}

         {/* Persistent/Toast confirmation message visible across state transition */}
         {uploadMessage.text && uploadMessage.type === 'success' && topic.assignmentSubmitted && (
           <div className="text-xs font-bold p-3 rounded-xl border flex items-start gap-2.5 shadow-sm bg-teal-50/90 border-teal-100 text-teal-800 animate-fade-in mt-1">
             <span className="text-sm leading-none mt-0.5">🎉</span>
             <div className="flex-1">
               <span className="block">{uploadMessage.text}</span>
               <span className="text-[10px] text-teal-600 block mt-1 font-semibold">Your submission is secured and visible to faculty.</span>
             </div>
             <button 
               type="button" 
               onClick={() => setUploadMessage({ type: '', text: '' })}
               className="text-[10px] uppercase font-black tracking-wider text-teal-700 hover:text-teal-900 px-1.5 py-0.5 rounded border border-teal-200 hover:bg-teal-100 bg-white transition-all shadow-xs"
             >
               Okay
             </button>
           </div>
         )}
      </div>
    </div>
  );
};

export default function StudentDashboard() {
  const { user, studentName, studentBatch } = useAuth();
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('All');
  const [actionError, setActionError] = useState('');
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Settings
  const [globalSettings, setGlobalSettings] = useState<any>(null);

  useEffect(() => {
    if (!user) return;

    const q = query(collection(db, "topics"));
    const unsubscribeTopics = onSnapshot(q, (snapshot) => {
      const topicsData: Topic[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (data.published !== false) {
          topicsData.push({ id: doc.id, ...data } as Topic);
        }
      });
      // Sort by status (Available first) and then title
      topicsData.sort((a, b) => {
        if (a.status === b.status) return a.title.localeCompare(b.title);
        return a.status === 'Available' ? -1 : 1;
      });
      setTopics(topicsData);
      setLoading(false);
    }, (error) => {
      console.warn("Topics listener error:", error);
      setLoading(false);
    });

    const settingsRef = doc(db, 'settings', 'general');
    const unsubscribeSettings = onSnapshot(settingsRef, (docSnap) => {
      if (docSnap.exists()) {
        setGlobalSettings(docSnap.data());
      }
    }, (error) => {
      console.warn("Settings listener error:", error);
    });

    return () => {
      unsubscribeTopics();
      unsubscribeSettings();
    };
  }, [user]);

  const handleSelectTopic = async (topicId: string) => {
    if (!user) return;
    setActionError('');

    const targetTopic = topics.find(t => t.id === topicId);
    if (!targetTopic) return;

    if (targetTopic.subject) {
      const alreadyHasSubject = topics.some(t => t.studentId === user.uid && t.subject === targetTopic.subject);
      if (alreadyHasSubject) {
        setActionError(`You have already selected a topic for the subject: ${targetTopic.subject}. You can only select one topic per subject.`);
        return;
      }
    }

    setProcessingId(topicId);

    try {
      const userRef = doc(db, 'users', user.uid);
      const topicRef = doc(db, 'topics', topicId);

      await runTransaction(db, async (transaction) => {
        const userDoc = await transaction.get(userRef);
        const topicDoc = await transaction.get(topicRef);

        if (!userDoc.exists() || !topicDoc.exists()) {
          throw new Error("Document does not exist!");
        }

        const topicData = topicDoc.data() as Topic;

        if (topicData.status !== 'Available') {
          throw new Error("This topic has already been taken by someone else.");
        }

        const userData = userDoc.data();
        const finalName = userData?.name || user.displayName || 'Unknown Student';
        const finalBatch = userData?.batch || 'Unknown Batch';
        const finalEmail = userData?.email || user.email || 'Unknown Email';

        transaction.update(topicRef, {
          status: 'Taken',
          studentId: user.uid,
          studentName: finalName,
          studentBatch: finalBatch,
          studentEmail: finalEmail,
          timestamp: new Date().toISOString()
        });

      });

    } catch (err: any) {
      setActionError(err.message);
    } finally {
      setProcessingId(null);
    }
  };

  const subjects = Array.from(new Set(topics.filter(t => t.subject).map(t => t.subject)));

  const filteredTopics = topics.filter(t => {
    const matchesSearch = t.title.toLowerCase().includes(search.toLowerCase()) || 
                          t.description.toLowerCase().includes(search.toLowerCase());
    const matchesSubject = subjectFilter === 'All' || t.subject === subjectFilter;
    return matchesSearch && matchesSubject;
  });

  const myTopics = topics.filter(t => t.studentId === user?.uid);

  if (loading) return <div className="text-center py-12 text-slate-500">Loading topics...</div>;

  return (
    <div className="flex flex-col gap-6 w-full">
      
      {myTopics.length > 0 && (
        <div className="flex flex-col gap-4">
          {myTopics.map(topic => (
            <SelectedTopicCard 
              key={topic.id} 
              topic={topic} 
              globalSettings={globalSettings} 
              user={user} 
              studentName={studentName} 
              studentBatch={studentBatch} 
            />
          ))}
        </div>
      )}

      {actionError && (
        <div className="bg-rose-50 text-rose-600 p-4 border border-rose-200 rounded-2xl text-sm font-medium shadow-sm">
          {actionError}
        </div>
      )}

      <div className="bg-white rounded-3xl border border-slate-200 flex flex-col overflow-hidden shadow-sm flex-1">
        <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center bg-white">
          <h2 className="text-lg font-bold flex items-center gap-2 text-slate-800">
            Topic Inventory
          </h2>
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            {subjects.length > 0 && (
               <select
                 value={subjectFilter}
                 onChange={e => setSubjectFilter(e.target.value)}
                 className="px-4 py-2 border-none bg-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm font-medium text-slate-700 transition-colors cursor-pointer appearance-none"
               >
                 <option value="All">All Subjects</option>
                 {subjects.map((subj, idx) => (
                   <option key={idx} value={subj as string}>{subj as string}</option>
                 ))}
               </select>
            )}
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type="text" 
                placeholder="Search topics..."
                className="w-full pl-10 pr-4 py-2 border-none bg-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm font-medium text-slate-700 transition-colors"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="p-6 overflow-y-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTopics.map(topic => (
              <div 
                key={topic.id} 
                className={`border rounded-3xl p-6 flex flex-col transition-all duration-200 shadow-sm ${
                  topic.status === 'Taken' 
                    ? 'bg-slate-50 border-slate-200 opacity-[0.85]' 
                    : 'bg-white border-slate-200 hover:shadow-md hover:border-teal-100 hover:bg-teal-50/10'
                }`}
              >
                {topic.subject && (
                  <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">
                    {topic.subject}
                  </div>
                )}
                <div className="flex justify-between items-start mb-4 gap-3">
                  <h3 className="font-bold text-slate-800 leading-snug">{topic.title}</h3>
                </div>
                <p className="text-slate-500 text-sm mb-4 flex-grow">{topic.description}</p>
                
                {topic.deadline && (
                  <div className="text-[11px] font-medium text-slate-500 bg-slate-100 px-2.5 py-1.5 rounded-xl border border-slate-200/60 mb-4 inline-flex items-center gap-1.5 self-start">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-pulse"></span>
                    Deadline: {format(new Date(topic.deadline), 'MMM d, h:mm a')}
                  </div>
                )}
                
                <div className="mt-auto pt-5 border-t border-slate-100 flex flex-col gap-3">
                  {topic.status === 'Taken' ? (
                    <div className="flex flex-col gap-1 items-start w-full">
                       <span className="flex items-center gap-1.5 text-xs text-rose-600 font-bold uppercase tracking-wider mb-2">
                         <span className="w-2 h-2 rounded-full bg-rose-600"></span> LOCKED
                       </span>
                       <p className="text-sm font-semibold text-slate-700">
                         {topic.studentName} <span className="text-slate-400 font-normal">{topic.studentBatch ? `(${topic.studentBatch})` : ''}</span>
                       </p>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3 w-full">
                      <span className="flex items-center gap-1.5 text-xs text-teal-600 font-bold uppercase tracking-wider">
                         <span className="w-2 h-2 rounded-full bg-teal-600"></span> AVAILABLE
                      </span>
                      <button
                        onClick={() => handleSelectTopic(topic.id)}
                        disabled={myTopics.some(t => t.subject === topic.subject) || processingId === topic.id}
                        className="w-full py-2.5 bg-teal-600 text-white hover:bg-teal-700 font-bold rounded-xl text-xs uppercase tracking-widest transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm shadow-teal-200 flex justify-center items-center gap-2"
                      >
                        {processingId === topic.id ? 'Processing...' : 'SELECT TOPIC'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {filteredTopics.length === 0 && (
              <div className="col-span-full py-16 text-center text-slate-500 font-medium bg-slate-50 border border-slate-200 border-dashed rounded-3xl">
                No topics found matching your criteria.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
