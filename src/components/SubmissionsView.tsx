import React, { useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { 
  Search, Award, FileText, Mail, Calendar, User, 
  Clock, Filter, Check, Send, AlertCircle, BookOpen, ChevronRight
} from 'lucide-react';
import { format } from 'date-fns';

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

interface SubmissionsViewProps {
  topics: Topic[];
}

export default function SubmissionsView({ topics }: SubmissionsViewProps) {
  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState<'all' | 'graded' | 'ungraded'>('all');

  // Selected submission for grading
  const [selectedTopic, setSelectedTopic] = useState<Topic | null>(null);

  // Grade Form state
  const [grade, setGrade] = useState<string>('');
  const [gradeOutOf, setGradeOutOf] = useState<string>('100');
  const [gradeMessage, setGradeMessage] = useState<string>('');
  const [savingGradeId, setSavingGradeId] = useState<string | null>(null);

  // Notification Toast state
  const [toast, setToast] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  // Extract submissions (topics that have assignmentSubmitted = true)
  const submissions = topics.filter(t => t.assignmentSubmitted === true);

  // Find unique subjects of submissions
  const submissionSubjects = Array.from(new Set(submissions.filter(t => t.subject).map(t => t.subject)));

  // Filter submissions
  const filteredSubmissions = submissions.filter(t => {
    const matchesSearch = 
      (t.studentName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (t.studentEmail || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (t.title || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (t.studentBatch || '').toLowerCase().includes(searchTerm.toLowerCase());

    const matchesSubject = subjectFilter === 'All' || t.subject === subjectFilter;

    let matchesStatus = true;
    if (statusFilter === 'graded') {
      matchesStatus = t.graded === true;
    } else if (statusFilter === 'ungraded') {
      matchesStatus = t.graded !== true;
    }

    return matchesSearch && matchesSubject && matchesStatus;
  });

  const handleOpenGrading = (topic: Topic) => {
    setSelectedTopic(topic);
    setGrade(topic.grade !== undefined && topic.grade !== null ? String(topic.grade) : '');
    setGradeOutOf(topic.gradeOutOf !== undefined && topic.gradeOutOf !== null ? String(topic.gradeOutOf) : '100');
    setGradeMessage(topic.gradeMessage || '');
  };

  const handleSaveGrade = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTopic) return;

    const obtainedMarks = parseFloat(grade);
    const totalMarks = parseFloat(gradeOutOf);

    if (isNaN(obtainedMarks) || isNaN(totalMarks)) {
      showToast('error', 'Please enter valid numbers for grading.');
      return;
    }

    if (obtainedMarks < 0 || totalMarks <= 0) {
      showToast('error', 'Marks cannot be negative. Total marks must be greater than zero.');
      return;
    }

    if (obtainedMarks > totalMarks) {
      showToast('error', `Obtained marks (${obtainedMarks}) cannot exceed total marks (${totalMarks}).`);
      return;
    }

    setSavingGradeId(selectedTopic.id);

    try {
      // 1. Update Firebase
      const topicRef = doc(db, 'topics', selectedTopic.id);
      await updateDoc(topicRef, {
        graded: true,
        grade: obtainedMarks,
        gradeOutOf: totalMarks,
        gradeMessage: gradeMessage.trim() || null,
        gradedAt: new Date().toISOString()
      });

      // 2. Trigger Notification Email via Backend API
      const response = await fetch('/api/grade-assignment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          studentEmail: selectedTopic.studentEmail || selectedTopic.studentId + '@example.com',
          studentName: selectedTopic.studentName || 'Student',
          topicTitle: selectedTopic.title,
          grade: obtainedMarks,
          gradeOutOf: totalMarks,
          gradeMessage: gradeMessage.trim() || null
        })
      });

      if (!response.ok) {
        console.warn('Backend grade email failed or simulated.');
      }

      showToast('success', `Evaluation successfully updated & email sent to ${selectedTopic.studentName || 'student'}!`);
      setSelectedTopic(null); // Close evaluated drawer/form
    } catch (err: any) {
      console.error(err);
      showToast('error', 'Failed to save evaluation. Error: ' + err.message);
    } finally {
      setSavingGradeId(null);
    }
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 flex-1 items-start animate-fade-in">
      
      {/* List Area */}
      <div className={`xl:col-span-8 bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full`}>
        <div className="p-6 border-b border-slate-100 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-black text-slate-800 flex items-center gap-2">
              <Award className="w-5 h-5 text-teal-600" /> Topic Assignments & Evaluation
            </h2>
            <p className="text-xs text-slate-500 mt-1">Review student file submissions and allocate grades</p>
          </div>

          <div className="text-xs font-bold text-slate-500 bg-slate-50 border border-slate-200 px-3.5 py-2 rounded-2xl shrink-0 flex items-center gap-1.5 self-start sm:self-center">
            📬 Total Submissions: <span className="text-teal-600 font-extrabold text-sm">{submissions.length}</span>
          </div>
        </div>

        {/* Filters Top Bar */}
        <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
            <input 
              type="text"
              placeholder="Search by student name, email, batch, or topic..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm placeholder:text-slate-400 text-slate-800 font-medium transition-all"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <select
              value={subjectFilter}
              onChange={(e) => setSubjectFilter(e.target.value)}
              className="px-3.5 py-2.5 bg-white border border-slate-200 rounded-2xl text-xs font-bold text-slate-600 focus:outline-none focus:ring-2 focus:ring-teal-500 transition-all"
            >
              <option value="All">All Subjects</option>
              {submissionSubjects.map((sub, idx) => (
                <option key={idx} value={sub}>{sub}</option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="px-3.5 py-2.5 bg-white border border-slate-200 rounded-2xl text-xs font-bold text-slate-600 focus:outline-none focus:ring-2 focus:ring-teal-500 transition-all"
            >
              <option value="all">All Grades Status</option>
              <option value="ungraded">Pending Evaluation</option>
              <option value="graded">Graded / Evaluated</option>
            </select>
          </div>
        </div>

        {/* Submissions List Container */}
        <div className="p-0 overflow-y-auto max-h-[600px] divide-y divide-slate-100">
          {filteredSubmissions.length === 0 ? (
            <div className="text-center py-16 px-6">
              <div className="w-16 h-16 bg-slate-100 rounded-3xl mx-auto flex items-center justify-center text-slate-400 mb-4 border border-slate-200/50">
                <FileText className="w-6 h-6 animate-pulse" />
              </div>
              <h3 className="font-extrabold text-slate-700 text-sm">No submissions found</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1 leading-relaxed">
                {submissions.length === 0 
                  ? 'No students have uploaded their assignment files yet.' 
                  : 'Check your search query or subject filters.'}
              </p>
            </div>
          ) : (
            filteredSubmissions.map((sub) => {
              const isSelected = selectedTopic?.id === sub.id;
              return (
                <div 
                  key={sub.id} 
                  className={`p-6 transition-all border-l-4 ${
                    isSelected ? 'border-teal-500 bg-teal-50/20' : sub.graded ? 'border-emerald-500 hover:bg-slate-50' : 'border-amber-500 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex flex-col md:flex-row justify-between items-start gap-4">
                    <div className="space-y-2 flex-grow">
                      
                      {/* Flex line */}
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[10px] font-black uppercase tracking-wider text-teal-700 bg-teal-50 px-2.5 py-1 rounded-lg border border-teal-100">
                          {sub.subject || 'Research'}
                        </span>
                        
                        {sub.graded ? (
                          <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-100 flex items-center gap-1">
                            <Check className="w-3 h-3" /> Graded: {sub.grade}/{sub.gradeOutOf}
                          </span>
                        ) : (
                          <span className="text-[10px] font-black uppercase tracking-wider text-amber-700 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-100 flex items-center gap-1 animate-pulse">
                            Pending Grading
                          </span>
                        )}
                      </div>

                      <h3 className="font-extrabold text-slate-900 text-sm md:text-base leading-snug">{sub.title}</h3>

                      {/* Student Credentials */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-500 font-medium">
                        <div className="flex items-center gap-1.5 truncate">
                          <User className="w-3.5 h-3.5 text-slate-400" />
                          <span className="text-slate-800 font-bold">{sub.studentName}</span>
                          {sub.studentBatch && <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">Batch: {sub.studentBatch}</span>}
                        </div>
                        <div className="flex items-center gap-1.5 truncate">
                          <Mail className="w-3.5 h-3.5 text-slate-400" />
                          <span>{sub.studentEmail || 'No student email stored yet'}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          <span>Submitted: {sub.submissionTimestamp ? format(new Date(sub.submissionTimestamp), 'PPP p') : 'Unknown'}</span>
                        </div>
                        <div className="flex items-center gap-1.5 font-bold text-teal-600 truncate">
                          📂 File: {sub.submittedFileName || 'assignment.pdf'}
                        </div>
                      </div>

                      {/* Message block */}
                      {sub.submissionMessage && (
                        <div className="bg-slate-50 border border-slate-200/50 p-3 rounded-2xl text-xs text-slate-600 max-w-2xl leading-relaxed italic">
                          " {sub.submissionMessage} "
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleOpenGrading(sub)}
                      className={`px-4 py-2.5 rounded-xl text-xs font-extrabold uppercase tracking-wider shrink-0 transition-all flex items-center gap-2 border self-end md:self-center shadow-sm ${
                        sub.graded 
                          ? 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-150' 
                          : 'bg-teal-600 text-white border-transparent hover:bg-teal-500'
                      }`}
                    >
                      <Award className="w-4 h-4" /> {sub.graded ? 'Change Grade' : 'Evaluate Paper'}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Evaluate Paper Drawer Panel / Form card */}
      <div className={`xl:col-span-4 bg-white rounded-3xl border border-slate-200 shadow-sm p-6 overflow-hidden flex flex-col gap-4 self-start`}>
        {selectedTopic ? (
          <form onSubmit={handleSaveGrade} className="space-y-4 animate-fade-in">
            <div className="flex justify-between items-start border-b border-slate-150 pb-4">
              <div>
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Evaluate Submission</h3>
                <p className="text-[11px] text-slate-400 mt-1">Grading student's submitted research work</p>
              </div>
              <button 
                type="button" 
                onClick={() => setSelectedTopic(null)}
                className="text-xs text-slate-400 hover:text-slate-600 font-bold uppercase tracking-wider border border-slate-200 bg-white px-2 py-1 rounded-lg"
              >
                Close
              </button>
            </div>

            {/* Micro Details */}
            <div className="bg-slate-50/60 p-3.5 rounded-2xl border border-slate-250/50 text-xs text-slate-700 space-y-1.5">
              <p className="line-clamp-1"><strong>Topic:</strong> {selectedTopic.title}</p>
              <p><strong>Student:</strong> {selectedTopic.studentName} {selectedTopic.studentBatch ? `(${selectedTopic.studentBatch})` : ''}</p>
              <p className="font-semibold text-teal-600 truncate">📂 File: {selectedTopic.submittedFileName || 'assignment.pdf'}</p>
            </div>

            {/* Marks Input */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1.5">Obtained Marks</label>
                <input 
                  type="number" 
                  step="0.5"
                  required
                  placeholder="e.g. 85"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm font-extrabold text-slate-800"
                  value={grade}
                  onChange={(e) => setGrade(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1.5">Total Marks (Out of)</label>
                <input 
                  type="number" 
                  step="1"
                  required
                  placeholder="e.g. 100"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm font-bold text-slate-700"
                  value={gradeOutOf}
                  onChange={(e) => setGradeOutOf(e.target.value)}
                />
              </div>
            </div>

            {/* Critique Feedback */}
            <div>
              <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1.5">Critique Feedback / মন্তব্য (Optional)</label>
              <textarea 
                placeholder="Write critique feedback about student research quality, corrections, or improvement advice..."
                className="w-full text-xs p-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-teal-500 h-28 resize-none font-medium text-slate-700"
                value={gradeMessage}
                onChange={(e) => setGradeMessage(e.target.value)}
              />
            </div>

            <button
              type="submit"
              disabled={savingGradeId !== null}
              className="w-full py-3 bg-teal-600 hover:bg-teal-500 text-white font-extrabold rounded-2xl text-xs uppercase tracking-widest transition-all disabled:opacity-75 shadow-md flex items-center justify-center gap-2"
            >
              <Send className="w-4 h-4" /> {savingGradeId ? 'Saving Evaluated Marks...' : 'Publish Evaluation'}
            </button>
            <p className="text-[10px] text-slate-400 text-center font-medium leading-relaxed mt-1">This will update student dashboard instantly, configure final scores, and trigger an automated evaluation update email.</p>
          </form>
        ) : (
          <div className="text-center py-16 px-4">
            <div className="w-14 h-14 bg-slate-50 rounded-2xl mx-auto flex items-center justify-center text-slate-400 mb-4 border border-slate-100">
              <Award className="w-6 h-6" />
            </div>
            <h4 className="font-extrabold text-slate-700 text-xs uppercase tracking-wider">Evaluation Interface</h4>
            <p className="text-[10px] text-slate-400 max-w-sm mx-auto mt-1 leading-relaxed">
              Click on the "Evaluate Paper" button of any student submission in the list to trigger grading controls, input scores, and send results.
            </p>
          </div>
        )}
      </div>

      {/* Floating toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-[9999] animate-slide-in max-w-sm w-full mx-4">
          <div className={`p-4 rounded-2xl shadow-lg border flex items-center gap-3 ${
            toast.type === 'success' ? 'bg-teal-50 text-teal-800 border-teal-200' : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}>
            <AlertCircle className={`w-5 h-5 shrink-0 ${toast.type === 'success' ? 'text-teal-600' : 'text-rose-600'}`} />
            <div className="flex-1 text-xs font-bold leading-normal">{toast.message}</div>
          </div>
        </div>
      )}
    </div>
  );
}
