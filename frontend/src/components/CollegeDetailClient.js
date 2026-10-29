'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import api, { cachedGet } from '@/lib/api';
import BottomNav from '@/components/BottomNav';
import {
  GraduationCap, ArrowLeft, Building2, MapPin, Globe, Award,
  IndianRupee, CheckCircle2, AlertCircle, Edit3, Trash2, Phone,
  MessageCircle, Download, FileText, ChevronRight, ChevronDown, ExternalLink,
  ShieldCheck, Clock, Share2, Layers, BookOpen, UserCheck, Sparkles,
  Check, X, Plus, Edit, AlertTriangle, Search
} from 'lucide-react';
import { COMMON_DEGREES, ACCREDITATION_TAGS, INSTITUTION_TYPES, getAccreditationBadgeStyle } from '@/lib/commonDegrees';
import SendFeeStructureWhatsAppModal from '@/components/catalogue/SendFeeStructureWhatsAppModal';
import { getUser, hasPermission, canViewField } from '@/lib/auth';
import { getResolvedRouteParam } from '@/lib/routeParams';

const ADMISSION_STATUS_LABELS = {
  admissions_open: { label: '🟢 Admissions Open', bg: '#ecfdf5', text: '#059669', border: '#a7f3d0' },
  seats_fast_filling: { label: '🔥 Seats Fast Filling', bg: '#fffbeb', text: '#d97706', border: '#fde68a' },
  merit_closed_mgmt_open: { label: '⚡ Merit Closed (Mgmt Open)', bg: '#f5f3ff', text: '#7c3aed', border: '#ddd6fe' },
  admissions_closed: { label: '🔴 Closed for Intake', bg: '#fef2f2', text: '#dc2626', border: '#fecaca' },
};

const MOU_STATUS_LABELS = {
  direct_tie_up: { label: '🤝 Direct University Tie-up', color: '#059669', bg: '#ecfdf5', border: '#a7f3d0' },
  sub_agent_mou: { label: '📑 Sub-Agent MOU', color: '#4f46e5', bg: '#eef2ff', border: '#c7d2fe' },
  informal_tie_up: { label: '📞 Direct Campus Contact', color: '#d97706', bg: '#fffbeb', border: '#fde68a' },
  none: { label: '⭕ No Formal Tie-up', color: '#64748b', bg: '#f8fafc', border: '#e2e8f0' },
};

export default function CollegeDetailClient() {
  const params = useParams();
  const router = useRouter();
  const [collegeId, setCollegeId] = useState(
    () => getResolvedRouteParam(params, 'id', 'colleges') || getResolvedRouteParam(params, 'id', 'catalogue')
  );

  useEffect(() => {
    const resolved = getResolvedRouteParam(params, 'id', 'colleges') || getResolvedRouteParam(params, 'id', 'catalogue');
    if (resolved && resolved !== collegeId) {
      setCollegeId(resolved);
    }
  }, [params]);

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [college, setCollege] = useState(null);
  const [isMyCatalogueItem, setIsMyCatalogueItem] = useState(false);
  const [expandedDegrees, setExpandedDegrees] = useState({});
  const [programSearch, setProgramSearch] = useState('');
  const [levelFilter, setLevelFilter] = useState('all');

  // Modals state
  const [showEditInfoModal, setShowEditInfoModal] = useState(false);
  const [showAddDegreeModal, setShowAddDegreeModal] = useState(false);
  const [showEditDegreeModal, setShowEditDegreeModal] = useState(false);
  const [degreeEditForm, setDegreeEditForm] = useState({
    currentDegreeName: '',
    newDegreeName: '',
    selectedTemplateDegree: '',
    level: 'Undergraduate',
    durationYears: 4,
    standardAnnualFee: 150000,
    currentStreams: [],
  });
  const [showAddSpecModal, setShowAddSpecModal] = useState(false);
  const [targetDegreeForSpec, setTargetDegreeForSpec] = useState(null);
  const [showEditCourseModal, setShowEditCourseModal] = useState(false);
  const [editingCourse, setEditingCourse] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // WhatsApp Fee Structure Modal State
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [selectedCourseForWhatsApp, setSelectedCourseForWhatsApp] = useState(null);
  const [selectedDegreeForWhatsApp, setSelectedDegreeForWhatsApp] = useState(null);

  const handleOpenWhatsAppFeeModal = (course, degree) => {
    setSelectedCourseForWhatsApp(course);
    setSelectedDegreeForWhatsApp(degree);
    setShowWhatsAppModal(true);
  };

  // Forms state
  const [infoForm, setInfoForm] = useState({
    customCollegeName: '',
    city: '',
    state: '',
    country: 'India',
    collegeType: 'Private University',
    accreditation: [],
    website: '',
    establishedYear: '',
    affiliatedUniversity: '',
    brochureUrl: '',
    notes: '',
  });

  const [degreeForm, setDegreeForm] = useState({
    selectedTemplateDegree: COMMON_DEGREES[0].degreeName,
    customDegreeName: '',
    level: 'Undergraduate',
    durationYears: 4,
    standardAnnualFee: 200000,
    selectedSpecializations: COMMON_DEGREES[0].specializations.slice(0, 5),
  });

  const [specForm, setSpecForm] = useState({
    degreeName: '',
    specialization: '',
    annualTuitionFee: 180000,
    packageFee: 720000,
    hostelFeePerYear: 80000,
    oneTimeAdmissionFee: 20000,
    currency: 'INR',
    feeNotes: '',
    commissionRate: 10,
    commissionType: 'percentage',
    mouStatus: 'direct_tie_up',
    contactPersonName: '',
    contactPersonPhone: '',
    contactPersonEmail: '',
    admissionStatus: 'admissions_open',
    quotaType: 'management_quota',
  });

  const [courseForm, setCourseForm] = useState({
    degreeName: '',
    specialization: '',
    annualTuitionFee: 0,
    packageFee: 0,
    hostelFeePerYear: 0,
    oneTimeAdmissionFee: 0,
    currency: 'INR',
    feeNotes: '',
    commissionRate: 10,
    commissionType: 'percentage',
    mouStatus: 'direct_tie_up',
    contactPersonName: '',
    contactPersonPhone: '',
    contactPersonEmail: '',
    admissionStatus: 'admissions_open',
    quotaType: 'management_quota',
  });

  useEffect(() => {
    const updateAuth = () => {
      setUser(getUser());
    };
    updateAuth();
    window.addEventListener('user-updated', updateAuth);
    if (collegeId && collegeId !== 'placeholder') {
      loadCollegeDetails();
    }
    return () => window.removeEventListener('user-updated', updateAuth);
  }, [collegeId]);

  const loadCollegeDetails = async (isManual = false) => {
    if (!college && !isManual) setLoading(true);
    try {
      // 1. Try finding in user's active catalogue directly first
      let foundInMy = null;
      try {
        const itemRes = await cachedGet(`/catalogue/my-catalogue/${collegeId}`, { forceRefresh: isManual });
        if (itemRes.data?.catalogueItem) {
          foundInMy = itemRes.data.catalogueItem;
        }
      } catch (err) {
        // Fallback: check my-catalogue array
        try {
          const myRes = await cachedGet('/catalogue/my-catalogue', { forceRefresh: isManual });
          const myItems = myRes.data?.catalogue || [];
          foundInMy = myItems.find(c =>
            String(c._id) === String(collegeId) ||
            String(c.masterCollegeId?._id) === String(collegeId) ||
            String(c.masterCollegeId) === String(collegeId)
          );
        } catch { }
      }

      if (foundInMy) {
        setCollege(foundInMy);
        setIsMyCatalogueItem(true);
        const initExpand = {};
        (foundInMy.courses || []).forEach(c => {
          if (c.degreeName) initExpand[c.degreeName] = true;
        });
        setExpandedDegrees(initExpand);
      } else {
        // 2. Fallback to master colleges catalog (read-only view with import option)
        const masterRes = await cachedGet(`/catalogue/master-colleges/${collegeId}`, { forceRefresh: isManual });
        if (masterRes.data?.college) {
          setCollege(masterRes.data.college);
          setIsMyCatalogueItem(false);
          const initExpand = {};
          (masterRes.data.college.courses || []).forEach(c => {
            if (c.degreeName) initExpand[c.degreeName] = true;
          });
          setExpandedDegrees(initExpand);
        } else {
          toast.error('College not found in catalogue');
        }
      }
    } catch (err) {
      toast.error('Failed to load college details');
    } finally {
      setLoading(false);
    }
  };

  // Group Courses into Degrees Hierarchy
  const degreesGrouped = useMemo(() => {
    if (!college) return [];
    const courses = college.courses || [];
    const map = {};

    courses.forEach(c => {
      const dName = c.degreeName || 'Other Programs';
      if (!map[dName]) {
        map[dName] = {
          degreeName: dName,
          level: c.level || 'Undergraduate',
          durationYears: c.durationYears || 4,
          streams: [],
        };
      }
      map[dName].streams.push(c);
    });

    return Object.values(map);
  }, [college]);

  // Filtered Degrees Hierarchy based on fast search and level filter
  const filteredDegreesGrouped = useMemo(() => {
    const rawQuery = programSearch.trim().toLowerCase();
    const cleanQuery = rawQuery.replace(/[\.\-\/\s]/g, '');

    return degreesGrouped
      .map(deg => {
        // Check level filter
        if (levelFilter !== 'all' && deg.level !== levelFilter) {
          return null;
        }

        if (!rawQuery) {
          return deg;
        }

        const degName = deg.degreeName?.toLowerCase() || '';
        const degClean = degName.replace(/[\.\-\/\s]/g, '');
        const degLevel = deg.level?.toLowerCase() || '';

        const degreeMatches =
          degName.includes(rawQuery) ||
          degClean.includes(cleanQuery) ||
          degLevel.includes(rawQuery);

        // Filter streams matching query
        const matchingStreams = deg.streams.filter(course => {
          const spec = (course.specialization || '').toLowerCase();
          const specClean = spec.replace(/[\.\-\/\s]/g, '');
          const admStatus = (course.admissionStatus || '').toLowerCase();
          const quota = (course.quotaType || '').toLowerCase();

          return (
            spec.includes(rawQuery) ||
            specClean.includes(cleanQuery) ||
            admStatus.includes(rawQuery) ||
            quota.includes(rawQuery)
          );
        });

        // If specific stream matched, show degree with those matching streams
        if (matchingStreams.length > 0) {
          return {
            ...deg,
            streams: matchingStreams,
            hasStreamMatch: true,
            totalStreamsInDegree: deg.streams.length,
          };
        }

        // If degree name itself matched (e.g. user typed "MBA" or "B.Tech"), keep all streams of that degree
        if (degreeMatches) {
          return {
            ...deg,
            streams: deg.streams,
            hasDegreeMatch: true,
            totalStreamsInDegree: deg.streams.length,
          };
        }

        return null;
      })
      .filter(Boolean);
  }, [degreesGrouped, programSearch, levelFilter]);

  const totalMatchingStreams = useMemo(() => {
    return filteredDegreesGrouped.reduce((acc, d) => acc + (d.streams?.length || 0), 0);
  }, [filteredDegreesGrouped]);

  const toggleDegreeExpand = (degreeName) => {
    setExpandedDegrees(prev => ({
      ...prev,
      [degreeName]: !prev[degreeName],
    }));
  };

  // 1-Click Import (from Master View)
  const handleImportToMyCatalogue = async () => {
    setSubmitting(true);
    try {
      const res = await api.post(`/catalogue/import/${college._id}`, {
        defaultCommissionRate: 10,
        defaultMouStatus: 'direct_tie_up',
      });
      toast.success(res.data?.message || 'Imported to active catalogue! 🎉');
      if (res.data?.catalogueItem) {
        setCollege(res.data.catalogueItem);
        setIsMyCatalogueItem(true);
      } else {
        loadCollegeDetails();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to import college');
    } finally {
      setSubmitting(false);
    }
  };

  // Open Edit Institution Header Info Modal
  const handleOpenEditInfo = () => {
    setInfoForm({
      customCollegeName: college.customCollegeName || college.name || '',
      city: college.location?.city || '',
      state: college.location?.state || '',
      country: college.location?.country || 'India',
      collegeType: college.collegeType || college.type || 'Private University',
      accreditation: college.accreditation || [],
      website: college.website || '',
      establishedYear: college.establishedYear || '',
      affiliatedUniversity: college.affiliatedUniversity || '',
      brochureUrl: college.brochureUrl || '',
      notes: college.notes || '',
    });
    setShowEditInfoModal(true);
  };

  // Save Institution Info
  const handleSaveInfo = async (e) => {
    e.preventDefault();
    if (!college || !isMyCatalogueItem) return;
    setSubmitting(true);
    try {
      const res = await api.put(`/catalogue/my-catalogue/${college._id}/info`, {
        customCollegeName: infoForm.customCollegeName,
        location: {
          city: infoForm.city,
          state: infoForm.state,
          country: infoForm.country,
        },
        collegeType: infoForm.collegeType,
        accreditation: infoForm.accreditation,
        website: infoForm.website,
        establishedYear: infoForm.establishedYear,
        affiliatedUniversity: infoForm.affiliatedUniversity,
        brochureUrl: infoForm.brochureUrl,
        notes: infoForm.notes,
      });

      toast.success('Institution profile updated successfully! ✅');
      setCollege(res.data?.catalogueItem || { ...college, ...infoForm });
      setShowEditInfoModal(false);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update info');
    } finally {
      setSubmitting(false);
    }
  };

  // Open Add Degree Modal
  const handleOpenAddDegree = () => {
    const first = COMMON_DEGREES[0];
    setDegreeForm({
      selectedTemplateDegree: first.degreeName,
      customDegreeName: '',
      level: first.level,
      durationYears: first.durationYears,
      standardAnnualFee: first.standardAnnualFee,
      selectedSpecializations: first.specializations.slice(0, 6),
    });
    setShowAddDegreeModal(true);
  };

  // Handle Degree Template Selection
  const handleSelectDegreeTemplate = (degName) => {
    const found = COMMON_DEGREES.find(d => d.degreeName === degName);
    if (found) {
      setDegreeForm(prev => ({
        ...prev,
        selectedTemplateDegree: found.degreeName,
        level: found.level,
        durationYears: found.durationYears,
        standardAnnualFee: found.standardAnnualFee,
        selectedSpecializations: found.specializations.slice(0, 6),
      }));
    }
  };

  // Submit Add Degree
  const handleSaveDegree = async (e) => {
    e.preventDefault();
    if (!college || !isMyCatalogueItem) return;

    const degreeName = degreeForm.customDegreeName.trim() || degreeForm.selectedTemplateDegree;
    if (!degreeName) {
      return toast.error('Degree name is required');
    }

    setSubmitting(true);
    try {
      const res = await api.post(`/catalogue/my-catalogue/${college._id}/degrees`, {
        degreeName,
        level: degreeForm.level,
        durationYears: Number(degreeForm.durationYears) || 4,
        standardAnnualFee: Number(degreeForm.standardAnnualFee) || 150000,
        specializations: degreeForm.selectedSpecializations.length > 0
          ? degreeForm.selectedSpecializations
          : ['General Stream'],
      });

      toast.success(`Degree "${degreeName}" added with streams! 🎉`);
      setCollege(res.data?.catalogueItem);
      setShowAddDegreeModal(false);
      setExpandedDegrees(prev => ({ ...prev, [degreeName]: true }));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add degree');
    } finally {
      setSubmitting(false);
    }
  };

  // Open Edit Degree Modal
  const handleOpenEditDegree = (deg) => {
    const defaultAnnualFee = deg.streams?.[0]?.customFeeStructure?.annualTuitionFee || 150000;
    const matchingTemplate = COMMON_DEGREES.find(d => d.degreeName === deg.degreeName);
    setDegreeEditForm({
      currentDegreeName: deg.degreeName,
      newDegreeName: deg.degreeName,
      selectedTemplateDegree: matchingTemplate ? matchingTemplate.degreeName : 'CUSTOM',
      level: deg.level || 'Undergraduate',
      durationYears: deg.durationYears || 4,
      standardAnnualFee: defaultAnnualFee,
      currentStreams: deg.streams || [],
    });
    setShowEditDegreeModal(true);
  };

  // Submit Edit Degree (Rename, change duration/level/fee)
  const handleSaveEditDegree = async (e) => {
    e.preventDefault();
    if (!college || !degreeEditForm.currentDegreeName || !isMyCatalogueItem) return;
    if (!degreeEditForm.newDegreeName.trim()) {
      return toast.error('Degree program name cannot be empty');
    }

    setSubmitting(true);
    try {
      const res = await api.put(`/catalogue/my-catalogue/${college._id}/degrees/${encodeURIComponent(degreeEditForm.currentDegreeName)}`, {
        newDegreeName: degreeEditForm.newDegreeName.trim(),
        level: degreeEditForm.level,
        durationYears: Number(degreeEditForm.durationYears) || 4,
        standardAnnualFee: Number(degreeEditForm.standardAnnualFee) || undefined,
      });

      toast.success(`Degree updated successfully! ✨`);
      setCollege(res.data?.catalogueItem);
      setShowEditDegreeModal(false);

      if (degreeEditForm.newDegreeName !== degreeEditForm.currentDegreeName) {
        setExpandedDegrees(prev => {
          const next = { ...prev };
          next[degreeEditForm.newDegreeName] = next[degreeEditForm.currentDegreeName];
          delete next[degreeEditForm.currentDegreeName];
          return next;
        });
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update degree');
    } finally {
      setSubmitting(false);
    }
  };

  // Delete Degree
  const handleDeleteDegree = async (degreeName) => {
    if (!confirm(`Are you sure you want to delete the entire "${degreeName}" program and all its streams?`)) return;
    try {
      const res = await api.delete(`/catalogue/my-catalogue/${college._id}/degrees/${encodeURIComponent(degreeName)}`);
      toast.success(`Degree "${degreeName}" deleted ✅`);
      setCollege(res.data?.catalogueItem);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete degree');
    }
  };

  // Open Add Specialization Modal
  const handleOpenAddSpec = (deg) => {
    setTargetDegreeForSpec(deg);
    const foundDef = COMMON_DEGREES.find(d => d.degreeName === deg.degreeName);
    const existingSpecs = new Set((deg.streams || []).map(s => (s.specialization || '').toLowerCase().trim()));
    const availableSpecs = (foundDef?.specializations || []).filter(s => !existingSpecs.has(s.toLowerCase().trim()));
    const defaultSpec = availableSpecs[0] || (foundDef?.specializations?.[0]) || '';
    const defaultAnnual = deg.streams?.[0]?.customFeeStructure?.annualTuitionFee || 180000;
    const duration = deg.durationYears || 4;

    setSpecForm({
      degreeName: deg.degreeName,
      specialization: defaultSpec,
      annualTuitionFee: defaultAnnual,
      packageFee: defaultAnnual * duration,
      hostelFeePerYear: deg.streams?.[0]?.customFeeStructure?.hostelFeePerYear || 80000,
      oneTimeAdmissionFee: deg.streams?.[0]?.customFeeStructure?.oneTimeAdmissionFee || 20000,
      currency: deg.streams?.[0]?.customFeeStructure?.currency || 'INR',
      feeNotes: '',
      commissionRate: deg.streams?.[0]?.customTieUpDetails?.commissionRate ?? 10,
      commissionType: deg.streams?.[0]?.customTieUpDetails?.commissionType || 'percentage',
      mouStatus: deg.streams?.[0]?.customTieUpDetails?.mouStatus || 'direct_tie_up',
      contactPersonName: deg.streams?.[0]?.customTieUpDetails?.contactPersonName || '',
      contactPersonPhone: deg.streams?.[0]?.customTieUpDetails?.contactPersonPhone || '',
      contactPersonEmail: deg.streams?.[0]?.customTieUpDetails?.contactPersonEmail || '',
      admissionStatus: 'admissions_open',
      quotaType: 'management_quota',
    });
    setShowAddSpecModal(true);
  };

  // Submit Add Specialization
  const handleSaveSpec = async (e) => {
    e.preventDefault();
    if (!college || !targetDegreeForSpec || !isMyCatalogueItem) return;
    if (!specForm.specialization.trim()) {
      return toast.error('Specialization name is required');
    }

    setSubmitting(true);
    try {
      const res = await api.post(`/catalogue/my-catalogue/${college._id}/specializations`, {
        degreeName: targetDegreeForSpec.degreeName,
        specialization: specForm.specialization.trim(),
        annualTuitionFee: Number(specForm.annualTuitionFee) || 0,
        packageFee: Number(specForm.packageFee) || 0,
        hostelFeePerYear: Number(specForm.hostelFeePerYear) || 0,
        oneTimeAdmissionFee: Number(specForm.oneTimeAdmissionFee) || 0,
        currency: specForm.currency || 'INR',
        feeNotes: specForm.feeNotes || '',
        commissionRate: Number(specForm.commissionRate) || 10,
        commissionType: specForm.commissionType || 'percentage',
        mouStatus: specForm.mouStatus || 'direct_tie_up',
        contactPersonName: specForm.contactPersonName || '',
        contactPersonPhone: specForm.contactPersonPhone || '',
        contactPersonEmail: specForm.contactPersonEmail || '',
        admissionStatus: specForm.admissionStatus || 'admissions_open',
        quotaType: specForm.quotaType || 'management_quota',
        level: targetDegreeForSpec.level,
        durationYears: targetDegreeForSpec.durationYears,
      });

      toast.success(`Stream "${specForm.specialization}" added! 🎯`);
      setCollege(res.data?.catalogueItem);
      setShowAddSpecModal(false);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add specialization');
    } finally {
      setSubmitting(false);
    }
  };

  // Open Edit Specialization Fee & Tie-Up Modal
  const handleOpenEditCourse = (course) => {
    setEditingCourse(course);
    setCourseForm({
      degreeName: course.degreeName,
      specialization: course.specialization,
      annualTuitionFee: course.customFeeStructure?.annualTuitionFee || 0,
      packageFee: course.customFeeStructure?.packageFee || 0,
      hostelFeePerYear: course.customFeeStructure?.hostelFeePerYear || 0,
      oneTimeAdmissionFee: course.customFeeStructure?.oneTimeAdmissionFee || 0,
      currency: course.customFeeStructure?.currency || 'INR',
      feeNotes: course.customFeeStructure?.feeNotes || '',
      commissionRate: course.customTieUpDetails?.commissionRate || 10,
      commissionType: course.customTieUpDetails?.commissionType || 'percentage',
      mouStatus: course.customTieUpDetails?.mouStatus || 'direct_tie_up',
      contactPersonName: course.customTieUpDetails?.contactPersonName || '',
      contactPersonPhone: course.customTieUpDetails?.contactPersonPhone || '',
      contactPersonEmail: course.customTieUpDetails?.contactPersonEmail || '',
      admissionStatus: course.admissionStatus || 'admissions_open',
      quotaType: course.quotaType || 'management_quota',
    });
    setShowEditCourseModal(true);
  };

  // Submit Edit Specialization Course
  const handleSaveCourse = async (e) => {
    e.preventDefault();
    if (!college || !editingCourse || !isMyCatalogueItem) return;

    setSubmitting(true);
    try {
      const res = await api.put(`/catalogue/my-catalogue/${college._id}/courses/${editingCourse._id}`, {
        degreeName: courseForm.degreeName,
        specialization: courseForm.specialization,
        customFeeStructure: {
          annualTuitionFee: Number(courseForm.annualTuitionFee) || 0,
          packageFee: Number(courseForm.packageFee) || 0,
          hostelFeePerYear: Number(courseForm.hostelFeePerYear) || 0,
          oneTimeAdmissionFee: Number(courseForm.oneTimeAdmissionFee) || 0,
          currency: courseForm.currency,
          feeNotes: courseForm.feeNotes,
        },
        customTieUpDetails: {
          commissionType: courseForm.commissionType,
          commissionRate: Number(courseForm.commissionRate) || 0,
          mouStatus: courseForm.mouStatus,
          contactPersonName: courseForm.contactPersonName,
          contactPersonPhone: courseForm.contactPersonPhone,
          contactPersonEmail: courseForm.contactPersonEmail,
        },
        admissionStatus: courseForm.admissionStatus,
        quotaType: courseForm.quotaType,
      });

      toast.success(`Fee structure & tie-up updated for "${courseForm.specialization}"! 🎯`);
      setCollege(res.data?.catalogueItem);
      setShowEditCourseModal(false);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update stream');
    } finally {
      setSubmitting(false);
    }
  };

  // Delete Specialization
  const handleDeleteCourse = async (course) => {
    if (!confirm(`Delete stream "${course.specialization}" under ${course.degreeName}?`)) return;
    try {
      const res = await api.delete(`/catalogue/my-catalogue/${college._id}/courses/${course._id}`);
      toast.success(`Stream "${course.specialization}" removed ✅`);
      setCollege(res.data?.catalogueItem);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to remove stream');
    }
  };

  if (loading) {
    return (
      <div className="app-shell flex items-center justify-center min-h-[100dvh]">
        <div className="spinner" />
      </div>
    );
  }

  if (!college) {
    return (
      <div className="app-shell">
        <div className="page-container max-w-5xl mx-auto py-12 px-4 text-center">
          <div className="w-16 h-16 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 mx-auto mb-4">
            <GraduationCap size={32} />
          </div>
          <h2 className="text-xl font-bold text-slate-900">Institution Not Found</h2>
          <p className="text-slate-500 text-xs mt-1 mb-6">The requested college could not be retrieved from your catalogue or master repository.</p>
          <button onClick={() => router.push('/catalogue')} className="btn btn-primary btn-sm mx-auto">
            Back to Colleges & Courses
          </button>
        </div>
      </div>
    );
  }

  const collegeName = college.customCollegeName || college.name;
  const collegeType = college.collegeType || college.type || 'Private University';
  const collegeLocation = `${college.location?.city ? college.location.city + ', ' : ''}${college.location?.state || ''} ${college.location?.country ? '(' + college.location.country + ')' : ''}`;
  const totalStreamsCount = (college.courses || []).length;
  const accreditations = college.accreditation || [];

  return (
    <div className="app-shell pb-mobile-nav">
      <div className="page-container max-w-7xl mx-auto w-full px-3 sm:px-6 lg:px-8">
        
        {/* ─────────────────────────────────────────────────────────────
            TOP BREADCRUMB & HEADER ACTIONS
           ───────────────────────────────────────────────────────────── */}
        <div className="page-header flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => router.push('/catalogue')}
              className="p-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:border-slate-300 shadow-2xs transition flex-shrink-0"
              title="Back to Catalogue"
            >
              <ArrowLeft size={18} />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="page-title text-xl font-bold text-slate-900 truncate m-0">
                  {collegeName}
                </h1>
                {isMyCatalogueItem ? (
                  <span className="badge bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs px-2.5 py-0.5 rounded-full font-bold">
                    🏛️ Active Catalogue
                  </span>
                ) : (
                  <span className="badge bg-purple-50 text-purple-700 border border-purple-200 text-xs px-2.5 py-0.5 rounded-full font-bold">
                    🌐 Master Repository
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 truncate m-0 flex items-center gap-1.5 mt-0.5">
                <MapPin size={13} className="text-indigo-500 flex-shrink-0" />
                <span>{collegeLocation}</span> • <span className="text-slate-700 font-medium">{collegeType}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap sm:flex-nowrap w-full sm:w-auto">
            {/* Top Fast Program Search Bar */}
            <div className="relative w-full sm:w-60 md:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
              <input
                type="text"
                value={programSearch}
                onChange={e => setProgramSearch(e.target.value)}
                placeholder="Fast search program (e.g. CSE, MBA)..."
                className="w-full pl-9 pr-7 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-100 shadow-2xs"
              />
              {programSearch && (
                <button
                  type="button"
                  onClick={() => setProgramSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                  title="Clear search"
                >
                  <X size={13} />
                </button>
              )}
            </div>

            {isMyCatalogueItem ? (
              <>
                <button
                  type="button"
                  onClick={handleOpenEditInfo}
                  className="btn btn-secondary btn-sm flex items-center gap-1.5 text-xs py-1.5 px-3 rounded-xl font-semibold shrink-0"
                >
                  <Edit3 size={14} /> <span className="hidden sm:inline">Edit Institution</span>
                </button>
                <button
                  type="button"
                  onClick={handleOpenAddDegree}
                  className="btn btn-primary btn-sm flex items-center gap-1.5 text-xs py-1.5 px-3.5 rounded-xl font-bold shadow-sm shrink-0"
                >
                  <Plus size={15} /> <span>Add Degree</span>
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={handleImportToMyCatalogue}
                disabled={submitting}
                className="btn btn-primary btn-sm flex items-center gap-1.5 text-xs py-2 px-4 rounded-xl font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
              >
                {submitting ? <div className="spinner w-4 h-4" /> : <>📥 1-Click Import to My Catalogue</>}
              </button>
            )}
          </div>
        </div>

        {/* ─────────────────────────────────────────────────────────────
            SECTION 1: COLLEGE PROFILE & STATS BANNER
           ───────────────────────────────────────────────────────────── */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 mb-6 shadow-sm relative overflow-hidden">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-5 relative z-10">
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center flex-shrink-0 shadow-sm text-indigo-600 font-black text-xl">
                {college.masterCollegeId?.shortCode || collegeName.substring(0, 2).toUpperCase()}
              </div>

              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h2 className="text-xl sm:text-2xl font-bold text-slate-900 m-0 tracking-tight">
                    {collegeName}
                  </h2>
                  {isMyCatalogueItem && (
                    <button
                      type="button"
                      onClick={handleOpenEditInfo}
                      className="inline-flex items-center gap-1 text-xs py-1 px-2.5 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 font-bold transition shadow-2xs"
                      title="Edit Institution Profile Details"
                    >
                      <Edit3 size={12} /> Edit Profile
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-500 mt-1 flex-wrap">
                  <span className="flex items-center gap-1 font-medium text-slate-700">
                    <MapPin size={13} className="text-indigo-500" /> {collegeLocation}
                  </span>
                  <span>•</span>
                  <span className="text-indigo-700 font-semibold">{collegeType}</span>
                  {college.establishedYear && (
                    <>
                      <span>•</span>
                      <span>Est. {college.establishedYear}</span>
                    </>
                  )}
                  {college.website && (
                    <>
                      <span>•</span>
                      <a
                        href={college.website.startsWith('http') ? college.website : `https://${college.website}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-indigo-600 hover:text-indigo-700 flex items-center gap-1 font-semibold underline"
                      >
                        <Globe size={13} /> Visit Official Portal <ExternalLink size={11} />
                      </a>
                    </>
                  )}
                </div>

                {/* Accreditations Row */}
                {accreditations.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap mt-3">
                    {accreditations.map(acc => {
                      const style = getAccreditationBadgeStyle(acc);
                      return (
                        <span
                          key={acc}
                          style={{
                            background: style.bg,
                            color: style.text,
                            borderColor: style.border,
                          }}
                          className="px-2.5 py-0.5 rounded-md text-xs font-bold border tracking-wide shadow-2xs"
                        >
                          🏆 {acc}
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Quick Metrics Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 flex-shrink-0">
              <div className="bg-slate-50 border border-slate-200/80 p-3 rounded-xl min-w-[110px] text-center">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Degree Programs</span>
                <span className="text-lg font-bold text-indigo-600">
                  {programSearch.trim() || levelFilter !== 'all'
                    ? `${filteredDegreesGrouped.length} / ${degreesGrouped.length}`
                    : degreesGrouped.length}
                </span>
              </div>
              <div className="bg-slate-50 border border-slate-200/80 p-3 rounded-xl min-w-[110px] text-center">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Specializations</span>
                <span className="text-lg font-bold text-emerald-600">
                  {programSearch.trim() || levelFilter !== 'all'
                    ? `${totalMatchingStreams} / ${totalStreamsCount}`
                    : totalStreamsCount}
                </span>
              </div>
              {canViewField(user, 'customTieUpDetails') && (
                <div className="col-span-2 sm:col-span-1 bg-slate-50 border border-slate-200/80 p-3 rounded-xl min-w-[110px] text-center">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Tie-Up Commission</span>
                  <span className="text-lg font-bold text-amber-600">Avg. 10 - 15%</span>
                </div>
              )}
            </div>
          </div>

          {college.notes && (
            <div className="mt-4 pt-3 border-t border-slate-100 text-xs text-slate-600 flex items-start gap-2">
              <Sparkles size={14} className="text-amber-500 flex-shrink-0 mt-0.5" />
              <span><strong>Institutional Notes:</strong> {college.notes}</span>
            </div>
          )}
        </div>

        {/* ─────────────────────────────────────────────────────────────
            SECTION 2 & 3: DRILL-DOWN DEGREES & SPECIALIZATIONS HIERARCHY
           ───────────────────────────────────────────────────────────── */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-1">
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900 m-0 flex items-center gap-2">
                <GraduationCap size={20} className="text-indigo-600" />
                Academic Degree Programs & Custom Fee Structures
              </h3>
              <p className="text-xs text-slate-500 m-0">
                Drill down into any degree to customize seat fee structures, package amounts, and commercial payout MOUs.
              </p>
            </div>

            {isMyCatalogueItem && hasPermission(user, 'catalogue.manage_workspace') && (
              <button
                type="button"
                onClick={handleOpenAddDegree}
                className="btn btn-secondary btn-sm flex items-center gap-1.5 text-xs py-1.5 px-3 rounded-xl font-semibold self-start sm:self-auto shrink-0"
              >
                <Plus size={14} /> Add Degree
              </button>
            )}
          </div>

          {/* Fast Program & Specialization Search Toolbar */}
          {degreesGrouped.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-2xl p-3 sm:p-4 shadow-xs">
              <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2.5 sm:gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
                  <input
                    type="text"
                    value={programSearch}
                    onChange={e => setProgramSearch(e.target.value)}
                    placeholder="Search degree, branch or specialization (e.g. CSE, MBA, B.Pharm, AI, Finance)..."
                    className="w-full pl-10 pr-9 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition"
                  />
                  {programSearch && (
                    <button
                      type="button"
                      onClick={() => setProgramSearch('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-full hover:bg-slate-200 transition"
                      title="Clear search"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                {/* Level Filter Chips */}
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0 pb-1 md:pb-0">
                  {['all', 'Undergraduate', 'Postgraduate', 'Diploma'].map(lvl => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => setLevelFilter(lvl)}
                      className={`text-[11px] sm:text-xs font-semibold px-2.5 sm:px-3 py-1.5 rounded-lg border transition whitespace-nowrap ${
                        levelFilter === lvl
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {lvl === 'all' ? 'All Degrees' : lvl}
                    </button>
                  ))}
                </div>
              </div>

              {/* Live Search Status Feedback */}
              {(programSearch.trim() || levelFilter !== 'all') && (
                <div className="mt-2.5 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600 flex-wrap gap-2">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    Found <strong className="text-indigo-600 font-bold">{totalMatchingStreams}</strong> matching {totalMatchingStreams === 1 ? 'stream' : 'streams'} across <strong className="text-slate-800 font-bold">{filteredDegreesGrouped.length}</strong> {filteredDegreesGrouped.length === 1 ? 'degree' : 'degrees'}
                    {programSearch.trim() && <span className="text-slate-400 text-[11px]">(Auto-expanded for fast review)</span>}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setProgramSearch('');
                      setLevelFilter('all');
                    }}
                    className="text-xs text-indigo-600 hover:text-indigo-800 font-bold underline"
                  >
                    Reset Search Filters
                  </button>
                </div>
              )}
            </div>
          )}

          {degreesGrouped.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center shadow-sm">
              <div className="w-16 h-16 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 mx-auto mb-4">
                <GraduationCap size={32} />
              </div>
              <h4 className="text-base font-bold text-slate-900">No Degree Programs Added Yet</h4>
              <p className="text-xs text-slate-500 mt-1 mb-4">Add your first degree program (e.g. B.Tech, MBA, BCA) to start configuring fees.</p>
              {isMyCatalogueItem && hasPermission(user, 'catalogue.manage_workspace') && (
                <button type="button" onClick={handleOpenAddDegree} className="btn btn-primary btn-sm mx-auto">
                  <Plus size={14} /> Add Degree Program
                </button>
              )}
            </div>
          ) : filteredDegreesGrouped.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-8 sm:p-12 text-center shadow-xs">
              <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 mx-auto mb-3">
                <Search size={22} />
              </div>
              <h4 className="text-base font-bold text-slate-900">No programs match &ldquo;{programSearch}&rdquo;</h4>
              <p className="text-xs text-slate-500 mt-1 mb-4">
                No degrees or specializations found for this search. Try searching for another branch keyword or reset your filter.
              </p>
              <button
                type="button"
                onClick={() => {
                  setProgramSearch('');
                  setLevelFilter('all');
                }}
                className="btn btn-secondary btn-sm mx-auto"
              >
                Clear Search & Show All {totalStreamsCount} Programs
              </button>
            </div>
          ) : (
            filteredDegreesGrouped.map((deg, dIdx) => {
              const isSearching = Boolean(programSearch.trim());
              const isExpanded = isSearching ? true : Boolean(expandedDegrees[deg.degreeName]);
              const streamsCount = deg.streams.length;

              return (
                <div
                  key={deg.degreeName || dIdx}
                  className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs hover:border-slate-300 transition-all duration-200"
                >
                  {/* DEGREE ACCORDION HEADER */}
                  <div
                    onClick={() => toggleDegreeExpand(deg.degreeName)}
                    className="p-3.5 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-3 cursor-pointer select-none bg-slate-50/80 hover:bg-slate-100/80 transition"
                  >
                    <div className="flex items-start sm:items-center gap-2.5 sm:gap-3 min-w-0">
                      <button
                        type="button"
                        className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-white border border-slate-200 text-slate-600 flex items-center justify-center flex-shrink-0 shadow-2xs transition mt-0.5 sm:mt-0"
                      >
                        {isExpanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                      </button>

                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                          <h4 className="text-sm sm:text-base font-bold text-slate-900 m-0 tracking-tight">
                            {deg.degreeName}
                          </h4>
                          <span className="badge bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] sm:text-[11px] px-2 py-0.5 rounded-full font-bold">
                            {deg.level}
                          </span>
                          <span className="badge bg-slate-100 text-slate-700 border border-slate-200 text-[10px] sm:text-[11px] px-2 py-0.5 rounded-full font-medium">
                            ⏱️ {deg.durationYears} Years
                          </span>
                        </div>
                        <p className="text-[11px] sm:text-xs text-slate-500 m-0 mt-0.5 font-medium">
                          {isSearching && deg.hasStreamMatch ? (
                            <span className="text-indigo-600 font-semibold">
                              🎯 {deg.streams.length} of {deg.totalStreamsInDegree} Matching Specializations
                            </span>
                          ) : (
                            <span>{streamsCount} Specialization {streamsCount === 1 ? 'Stream' : 'Streams'} Configured</span>
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap justify-end pl-9 md:pl-0" onClick={e => e.stopPropagation()}>
                      {isMyCatalogueItem && hasPermission(user, 'catalogue.manage_workspace') && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleOpenEditDegree(deg)}
                            className="btn btn-secondary btn-sm text-xs py-1.5 px-2.5 rounded-lg flex items-center gap-1 text-indigo-700 border-indigo-200 hover:bg-indigo-50 font-bold transition shadow-2xs"
                            title="Edit Degree Program (Name, Level, Duration)"
                          >
                            <Edit3 size={13} /> Edit Degree
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenAddSpec(deg)}
                            className="btn btn-secondary btn-sm text-xs py-1.5 px-2.5 rounded-lg flex items-center gap-1 text-emerald-700 border-emerald-300 hover:bg-emerald-50 font-bold transition shadow-2xs"
                            title="Add Specialization Stream"
                          >
                            <Plus size={13} /> Add Stream
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteDegree(deg.degreeName)}
                            className="p-1.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-600 hover:bg-rose-100 transition shadow-2xs"
                            title="Delete Degree & All Streams"
                          >
                            <Trash2 size={14} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* SPECIALIZATIONS CARDS (INSIDE DEGREE) */}
                  {isExpanded && (
                    <div className="p-3.5 sm:p-5 pt-0 border-t border-slate-100 bg-white">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 mt-3 sm:mt-4">
                        {deg.streams.map((course, cIdx) => {
                          const fee = course.customFeeStructure || {};
                          const tieUp = course.customTieUpDetails || {};
                          const admStatus = ADMISSION_STATUS_LABELS[course.admissionStatus] || ADMISSION_STATUS_LABELS.admissions_open;
                          const mouStatus = MOU_STATUS_LABELS[tieUp.mouStatus] || MOU_STATUS_LABELS.direct_tie_up;

                          const q = programSearch.trim().toLowerCase();
                          const isMatch = Boolean(q) && (
                            (course.specialization || '').toLowerCase().includes(q) ||
                            (course.specialization || '').toLowerCase().replace(/[\.\-\/\s]/g, '').includes(q.replace(/[\.\-\/\s]/g, '')) ||
                            (course.admissionStatus || '').toLowerCase().includes(q) ||
                            (course.quotaType || '').toLowerCase().includes(q)
                          );

                          return (
                            <div
                              key={course._id || cIdx}
                              className={`rounded-xl p-3.5 sm:p-4 flex flex-col justify-between gap-3 shadow-2xs transition ${
                                isMatch
                                  ? 'bg-indigo-50/20 border-2 border-indigo-400 ring-2 ring-indigo-100 shadow-xs'
                                  : 'bg-white border border-slate-200 hover:border-indigo-300 hover:shadow-xs'
                              }`}
                            >
                              <div>
                                {/* Stream Header Row */}
                                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 mb-2">
                                  <div>
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <h5 className="text-sm font-bold text-slate-900 m-0 tracking-tight flex items-center gap-1.5 flex-wrap">
                                        <span>{course.specialization}</span>
                                        {isMatch && (
                                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700">
                                            Match
                                          </span>
                                        )}
                                      </h5>
                                      {isMyCatalogueItem && (
                                        <button
                                          type="button"
                                          onClick={() => handleOpenEditCourse(course)}
                                          className="text-indigo-600 hover:text-indigo-800 p-0.5 rounded hover:bg-indigo-50 transition"
                                          title="Quick Edit Specialization & Fees"
                                        >
                                          <Edit3 size={13} />
                                        </button>
                                      )}
                                    </div>
                                    <span className="text-[11px] text-slate-500 font-medium">
                                      {deg.degreeName} ({deg.durationYears} Years)
                                    </span>
                                  </div>

                                  <span
                                    style={{
                                      background: admStatus.bg,
                                      color: admStatus.text,
                                      borderColor: admStatus.border,
                                    }}
                                    className="px-2 py-0.5 rounded-md text-[10px] font-bold border flex-shrink-0 self-start sm:self-auto"
                                  >
                                    {admStatus.label}
                                  </span>
                                </div>

                                {/* Fee Structure Grid */}
                                <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-2.5 sm:p-3 grid grid-cols-2 gap-2 sm:gap-2.5 my-2.5">
                                  <div>
                                    <span className="text-[9px] sm:text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Annual Tuition</span>
                                    <span className="text-xs sm:text-sm font-bold text-emerald-600 truncate block">
                                      ₹{Number(fee.annualTuitionFee || 0).toLocaleString('en-IN')} <span className="text-[10px] font-normal text-slate-500">/ yr</span>
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-[9px] sm:text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Full Package Fee</span>
                                    <span className="text-xs sm:text-sm font-bold text-slate-900 truncate block">
                                      ₹{Number(fee.packageFee || 0).toLocaleString('en-IN')}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-[9px] sm:text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Hostel (Per Year)</span>
                                    <span className="text-xs font-semibold text-slate-700 truncate block">
                                      ₹{Number(fee.hostelFeePerYear || 0).toLocaleString('en-IN')}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-[9px] sm:text-[10px] font-bold text-slate-500 uppercase tracking-wider block">One-Time Fee</span>
                                    <span className="text-xs font-semibold text-slate-700 truncate block">
                                      ₹{Number(fee.oneTimeAdmissionFee || 0).toLocaleString('en-IN')}
                                    </span>
                                  </div>
                                </div>

                                {/* Commercial Tie-Up Banner */}
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 text-xs py-1.5 px-2.5 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-700 mb-1">
                                  <span className="font-semibold flex items-center gap-1">
                                    {mouStatus.label}
                                  </span>
                                  {canViewField(user, 'customTieUpDetails') && (
                                    <span className="font-bold text-amber-700 bg-amber-100 border border-amber-200 px-2 py-0.5 rounded text-[11px] self-start sm:self-auto">
                                      💰 Commission: {tieUp.commissionRate || 10}%
                                    </span>
                                  )}
                                </div>

                                {canViewField(user, 'customTieUpDetails') && (tieUp.contactPersonName || tieUp.contactPersonPhone) && (
                                  <p className="text-[11px] text-slate-500 m-0 mt-1 truncate">
                                    👤 SPOC: <strong className="text-slate-700">{tieUp.contactPersonName || 'Campus Desk'}</strong> {tieUp.contactPersonPhone ? `(${tieUp.contactPersonPhone})` : ''}
                                  </p>
                                )}
                              </div>

                              {/* Card Action Buttons */}
                              <div className="flex items-center justify-between gap-2 pt-2.5 border-t border-slate-100 mt-1 flex-wrap">
                                {isMyCatalogueItem && hasPermission(user, 'catalogue.manage_workspace') && (
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteCourse(course)}
                                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                                    title="Delete Specialization Stream"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                )}

                                <div className="flex items-center gap-2 ml-auto flex-wrap">
                                  {hasPermission(user, 'whatsapp.send_one_to_one') && (
                                  <button
                                    type="button"
                                    onClick={() => handleOpenWhatsAppFeeModal(course, deg)}
                                    className="btn btn-sm text-xs py-1 px-3 rounded-lg flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition shadow-2xs"
                                    title="Send Fee Structure directly to a Lead on WhatsApp"
                                  >
                                    <MessageCircle size={13} /> Send on WhatsApp
                                  </button>
                                  )}

                                  {isMyCatalogueItem && hasPermission(user, 'catalogue.manage_workspace') && (
                                    <button
                                      type="button"
                                      onClick={() => handleOpenEditCourse(course)}
                                      className="btn btn-secondary btn-sm text-xs py-1 px-2.5 rounded-lg flex items-center gap-1.5 text-indigo-700 hover:bg-indigo-50 border-indigo-200 font-bold transition shadow-2xs"
                                    >
                                      <Edit size={12} /> Edit Fee
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          MODAL 1: EDIT INSTITUTION HEADER INFO
         ───────────────────────────────────────────────────────────── */}
      {showEditInfoModal && (
        <div className="modal-overlay" onClick={() => setShowEditInfoModal(false)}>
          <div className="modal-sheet max-w-xl bg-white" onClick={e => e.stopPropagation()}>
            <div className="modal-handle" />
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-2xs shrink-0">
                  <Building2 size={18} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 m-0">Edit Institution Profile</h3>
                  <p className="text-xs text-slate-500 m-0 mt-0.5">Manage branding, location, types, and official affiliations</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowEditInfoModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition text-lg leading-none"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSaveInfo} className="space-y-3.5 max-h-[75vh] overflow-y-auto pr-1">
              <div>
                <label className="label">Institution Name *</label>
                <input
                  type="text"
                  className="input text-sm"
                  value={infoForm.customCollegeName}
                  onChange={e => setInfoForm(f => ({ ...f, customCollegeName: e.target.value }))}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">City</label>
                  <input
                    type="text"
                    className="input text-sm"
                    value={infoForm.city}
                    onChange={e => setInfoForm(f => ({ ...f, city: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="label">State</label>
                  <input
                    type="text"
                    className="input text-sm"
                    value={infoForm.state}
                    onChange={e => setInfoForm(f => ({ ...f, state: e.target.value }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Institution Type</label>
                  <select
                    className="input text-xs"
                    value={infoForm.collegeType}
                    onChange={e => setInfoForm(f => ({ ...f, collegeType: e.target.value }))}
                  >
                    {INSTITUTION_TYPES.map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Est. Year</label>
                  <input
                    type="number"
                    className="input text-sm"
                    placeholder="e.g. 1995"
                    value={infoForm.establishedYear}
                    onChange={e => setInfoForm(f => ({ ...f, establishedYear: e.target.value }))}
                  />
                </div>
              </div>

              <div>
                <label className="label">Official Website Portal</label>
                <input
                  type="url"
                  className="input text-sm"
                  placeholder="https://..."
                  value={infoForm.website}
                  onChange={e => setInfoForm(f => ({ ...f, website: e.target.value }))}
                />
              </div>

              <div>
                <label className="label">Accreditations & Approvals (Click to Toggle)</label>
                <div className="flex flex-wrap gap-1.5 p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
                  {ACCREDITATION_TAGS.map(tag => {
                    const isSelected = infoForm.accreditation.includes(tag);
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => {
                          setInfoForm(f => ({
                            ...f,
                            accreditation: isSelected
                              ? f.accreditation.filter(t => t !== tag)
                              : [...f.accreditation, tag]
                          }));
                        }}
                        className={`text-xs px-2.5 py-1 rounded-lg border font-semibold transition ${
                          isSelected
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-300 shadow-2xs'
                            : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        {isSelected ? '✓ ' : '+ '}{tag}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="label">Internal Notes / MOU Highlights</label>
                <textarea
                  className="input text-xs"
                  rows={2}
                  value={infoForm.notes}
                  onChange={e => setInfoForm(f => ({ ...f, notes: e.target.value }))}
                />
              </div>

              <div className="modal-actions pt-2 flex justify-end gap-2 border-t border-slate-100">
                <button type="button" className="btn btn-ghost" onClick={() => setShowEditInfoModal(false)}>Cancel</button>
                <button type="submit" disabled={submitting} className="btn btn-primary">
                  {submitting ? 'Saving...' : 'Save Institution Profile ✅'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODAL 2: ADD DEGREE PROGRAM (WITH AUTO-SPECIALIZATIONS)
         ───────────────────────────────────────────────────────────── */}
      {showAddDegreeModal && (
        <div className="modal-overlay" onClick={() => setShowAddDegreeModal(false)}>
          <div className="modal-sheet max-w-xl bg-white" onClick={e => e.stopPropagation()}>
            <div className="modal-handle" />
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-2xs shrink-0">
                  <Plus size={18} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 m-0">Add Degree Program</h3>
                  <p className="text-xs text-slate-500 m-0 mt-0.5">Select a standard template or custom title with auto-generated streams</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAddDegreeModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition text-lg leading-none"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSaveDegree} className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
              <div>
                <label className="label">Pick Standard Degree Template</label>
                <select
                  className="input text-xs"
                  value={degreeForm.selectedTemplateDegree}
                  onChange={e => handleSelectDegreeTemplate(e.target.value)}
                >
                  {COMMON_DEGREES.map(d => (
                    <option key={d.degreeName} value={d.degreeName}>
                      {d.degreeName} ({d.category})
                    </option>
                  ))}
                  <option value="CUSTOM">-- Custom Degree Name --</option>
                </select>
              </div>

              {degreeForm.selectedTemplateDegree === 'CUSTOM' && (
                <div>
                  <label className="label">Custom Degree Title *</label>
                  <input
                    type="text"
                    className="input text-sm"
                    placeholder="e.g. B.Voc in Digital Animation"
                    value={degreeForm.customDegreeName}
                    onChange={e => setDegreeForm(f => ({ ...f, customDegreeName: e.target.value }))}
                    required
                  />
                </div>
              )}

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="label">Academic Level</label>
                  <select
                    className="input text-xs"
                    value={degreeForm.level}
                    onChange={e => setDegreeForm(f => ({ ...f, level: e.target.value }))}
                  >
                    <option value="Undergraduate">Undergraduate (UG)</option>
                    <option value="Postgraduate">Postgraduate (PG)</option>
                    <option value="Diploma / Certification">Diploma</option>
                    <option value="Doctorate / PhD">Doctorate</option>
                  </select>
                </div>
                <div>
                  <label className="label">Duration (Yrs)</label>
                  <input
                    type="number"
                    className="input text-sm"
                    value={degreeForm.durationYears}
                    onChange={e => setDegreeForm(f => ({ ...f, durationYears: e.target.value }))}
                    min={1}
                    max={6}
                  />
                </div>
                <div>
                  <label className="label">Preset Annual Fee (₹)</label>
                  <input
                    type="number"
                    className="input text-sm"
                    value={degreeForm.standardAnnualFee}
                    onChange={e => setDegreeForm(f => ({ ...f, standardAnnualFee: e.target.value }))}
                  />
                </div>
              </div>

              {/* Specializations to Pre-Populate */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="label mb-0">Select Specialization Streams to Auto-Generate</label>
                  <span className="text-[11px] text-slate-400 font-medium">
                    {degreeForm.selectedSpecializations.length} selected
                  </span>
                </div>
                <div className="max-h-48 overflow-y-auto p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                  {COMMON_DEGREES.find(d => d.degreeName === degreeForm.selectedTemplateDegree)?.specializations?.map(spec => {
                    const isChecked = degreeForm.selectedSpecializations.includes(spec);
                    return (
                      <label
                        key={spec}
                        className="flex items-center gap-2.5 text-xs text-slate-700 hover:text-slate-900 p-1.5 rounded hover:bg-white cursor-pointer transition"
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            setDegreeForm(f => ({
                              ...f,
                              selectedSpecializations: isChecked
                                ? f.selectedSpecializations.filter(s => s !== spec)
                                : [...f.selectedSpecializations, spec]
                            }));
                          }}
                          className="rounded text-indigo-600 focus:ring-0"
                        />
                        <span>{spec}</span>
                      </label>
                    );
                  }) || (
                    <p className="text-xs text-slate-500 p-2">Will generate a "General Stream". You can add more specializations after creating.</p>
                  )}
                </div>
              </div>

              <div className="modal-actions pt-2 flex justify-end gap-2 border-t border-slate-100">
                <button type="button" className="btn btn-ghost" onClick={() => setShowAddDegreeModal(false)}>Cancel</button>
                <button type="submit" disabled={submitting} className="btn btn-primary">
                  {submitting ? 'Generating...' : 'Add Degree & Streams 🚀'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODAL 2.5: EDIT DEGREE PROGRAM (UNIFIED MAX-W-XL LAYOUT)
         ───────────────────────────────────────────────────────────── */}
      {showEditDegreeModal && (
        <div className="modal-overlay" onClick={() => setShowEditDegreeModal(false)}>
          <div className="modal-sheet max-w-xl bg-white" onClick={e => e.stopPropagation()}>
            <div className="modal-handle" />
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-2xs shrink-0">
                  <Edit3 size={18} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 m-0">Edit Degree Program</h3>
                  <p className="text-xs text-slate-500 m-0 mt-0.5">
                    Updating program specifications across associated streams under <strong className="text-slate-800">{degreeEditForm.currentDegreeName}</strong>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowEditDegreeModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition text-lg leading-none"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSaveEditDegree} className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
              <div>
                <label className="label">Quick Standard Degree Template Match</label>
                <select
                  className="input text-xs"
                  value={degreeEditForm.selectedTemplateDegree}
                  onChange={e => {
                    const sel = e.target.value;
                    const found = COMMON_DEGREES.find(d => d.degreeName === sel);
                    setDegreeEditForm(f => ({
                      ...f,
                      selectedTemplateDegree: sel,
                      newDegreeName: sel === 'CUSTOM' ? f.newDegreeName : (found ? found.degreeName : f.newDegreeName),
                      level: found ? found.level : f.level,
                      durationYears: found ? found.durationYears : f.durationYears,
                      standardAnnualFee: found ? found.standardAnnualFee : f.standardAnnualFee,
                    }));
                  }}
                >
                  {COMMON_DEGREES.map(d => (
                    <option key={d.degreeName} value={d.degreeName}>
                      {d.degreeName} ({d.category})
                    </option>
                  ))}
                  <option value="CUSTOM">-- Custom Degree Name --</option>
                </select>
              </div>

              <div>
                <label className="label">Degree Program Title *</label>
                <input
                  type="text"
                  className="input text-sm"
                  placeholder="e.g. B.Tech / B.E., MBA, MBBS"
                  value={degreeEditForm.newDegreeName}
                  onChange={e => setDegreeEditForm(f => ({ ...f, newDegreeName: e.target.value }))}
                  required
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="label">Academic Level</label>
                  <select
                    className="input text-xs"
                    value={degreeEditForm.level}
                    onChange={e => setDegreeEditForm(f => ({ ...f, level: e.target.value }))}
                  >
                    <option value="Undergraduate">Undergraduate (UG)</option>
                    <option value="Postgraduate">Postgraduate (PG)</option>
                    <option value="Diploma / Certification">Diploma</option>
                    <option value="Doctorate / PhD">Doctorate</option>
                  </select>
                </div>
                <div>
                  <label className="label">Duration (Yrs)</label>
                  <input
                    type="number"
                    className="input text-sm"
                    value={degreeEditForm.durationYears}
                    onChange={e => setDegreeEditForm(f => ({ ...f, durationYears: e.target.value }))}
                    min={1}
                    max={6}
                    required
                  />
                </div>
                <div>
                  <label className="label">Base Annual Fee (₹)</label>
                  <input
                    type="number"
                    className="input text-sm"
                    placeholder="e.g. 150000"
                    value={degreeEditForm.standardAnnualFee}
                    onChange={e => setDegreeEditForm(f => ({ ...f, standardAnnualFee: e.target.value }))}
                  />
                </div>
              </div>

              {/* Specializations Overview Section (Mirroring Add Degree Checklist) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="label mb-0">Configured Specialization Streams in this Degree</label>
                  <span className="text-[11px] text-indigo-600 font-bold">
                    {degreeEditForm.currentStreams?.length || 0} active {degreeEditForm.currentStreams?.length === 1 ? 'stream' : 'streams'}
                  </span>
                </div>
                <div className="max-h-48 overflow-y-auto p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                  {degreeEditForm.currentStreams && degreeEditForm.currentStreams.length > 0 ? (
                    degreeEditForm.currentStreams.map((st, sIdx) => (
                      <div
                        key={st._id || sIdx}
                        className="flex items-center justify-between p-2 rounded-lg bg-white border border-slate-200/80 text-xs shadow-2xs"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                          <span className="font-semibold text-slate-800 truncate">{st.specialization}</span>
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-slate-500 shrink-0">
                          <span>₹{Number(st.customFeeStructure?.annualTuitionFee || 0).toLocaleString('en-IN')}/yr</span>
                          {canViewField(user, 'customTieUpDetails') && (
                          <span className="badge bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded text-[10px] font-bold">
                            {st.customTieUpDetails?.commissionRate || 10}% Payout
                          </span>
                        )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-slate-500 p-2">No specializations currently configured under this degree.</p>
                  )}
                </div>
              </div>

              <div className="modal-actions pt-2 flex justify-end gap-2 border-t border-slate-100">
                <button type="button" className="btn btn-ghost" onClick={() => setShowEditDegreeModal(false)}>Cancel</button>
                <button type="submit" disabled={submitting} className="btn btn-primary">
                  {submitting ? 'Saving...' : 'Update Degree ✨'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODAL 3: ADD SPECIALIZATION UNDER A SPECIFIC DEGREE (UNIFIED)
         ───────────────────────────────────────────────────────────── */}
      {showAddSpecModal && targetDegreeForSpec && (
        <div className="modal-overlay" onClick={() => setShowAddSpecModal(false)}>
          <div className="modal-sheet max-w-xl bg-white" onClick={e => e.stopPropagation()}>
            <div className="modal-handle" />
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shadow-2xs shrink-0">
                  <Plus size={18} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 m-0">Add Specialization Stream</h3>
                  <p className="text-xs text-slate-500 m-0 mt-0.5">
                    Adding new stream under <strong className="text-slate-800">{targetDegreeForSpec.degreeName}</strong> ({targetDegreeForSpec.durationYears} Years • {targetDegreeForSpec.level})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAddSpecModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition text-lg leading-none"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSaveSpec} className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
              <div>
                <label className="label">Specialization Name *</label>
                <input
                  type="text"
                  className="input text-sm"
                  placeholder="e.g. Artificial Intelligence & Machine Learning"
                  value={specForm.specialization}
                  onChange={e => setSpecForm(f => ({ ...f, specialization: e.target.value }))}
                  required
                />
                
                {/* Quick Specialization Suggestions from COMMON_DEGREES */}
                {(() => {
                  const degDef = COMMON_DEGREES.find(d => d.degreeName === targetDegreeForSpec.degreeName);
                  const existingNames = new Set((targetDegreeForSpec.streams || []).map(s => (s.specialization || '').toLowerCase().trim()));
                  const suggestions = (degDef?.specializations || []).filter(s => !existingNames.has(s.toLowerCase().trim())).slice(0, 6);
                  if (suggestions.length === 0) return null;

                  return (
                    <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Suggestions:</span>
                      {suggestions.map(s => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setSpecForm(f => ({ ...f, specialization: s }))}
                          className={`text-[11px] px-2 py-0.5 rounded-md border transition ${
                            specForm.specialization === s
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-300 font-bold'
                              : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-white'
                          }`}
                        >
                          + {s}
                        </button>
                      ))}
                    </div>
                  );
                })()}
              </div>

              {/* CARD 1: Student Fee Package Breakdown */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <h5 className="text-xs font-bold uppercase tracking-wider text-emerald-700 m-0 flex items-center gap-1.5">
                  💳 Student Fee Package Breakdown
                </h5>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Annual Tuition Fee (₹) *</label>
                    <input
                      type="number"
                      className="input text-sm"
                      value={specForm.annualTuitionFee}
                      onChange={e => {
                        const annual = Number(e.target.value) || 0;
                        setSpecForm(f => ({
                          ...f,
                          annualTuitionFee: annual,
                          packageFee: annual * (targetDegreeForSpec.durationYears || 4),
                        }));
                      }}
                      required
                    />
                  </div>
                  <div>
                    <label className="label">Total Package Deal (₹)</label>
                    <input
                      type="number"
                      className="input text-sm"
                      value={specForm.packageFee}
                      onChange={e => setSpecForm(f => ({ ...f, packageFee: Number(e.target.value) }))}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Hostel Fee / Year (₹)</label>
                    <input
                      type="number"
                      className="input text-sm"
                      value={specForm.hostelFeePerYear}
                      onChange={e => setSpecForm(f => ({ ...f, hostelFeePerYear: Number(e.target.value) }))}
                    />
                  </div>
                  <div>
                    <label className="label">One-Time Admission Fee (₹)</label>
                    <input
                      type="number"
                      className="input text-sm"
                      value={specForm.oneTimeAdmissionFee}
                      onChange={e => setSpecForm(f => ({ ...f, oneTimeAdmissionFee: Number(e.target.value) }))}
                    />
                  </div>
                </div>

                <div>
                  <label className="label">Fee Notes / Scholarships</label>
                  <input
                    type="text"
                    className="input text-sm"
                    placeholder="e.g. 20% merit scholarship on 85%+ in 12th board"
                    value={specForm.feeNotes}
                    onChange={e => setSpecForm(f => ({ ...f, feeNotes: e.target.value }))}
                  />
                </div>
              </div>

              {/* CARD 2: Agency Commercial Tie-Up & Payout */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <h5 className="text-xs font-bold uppercase tracking-wider text-indigo-700 m-0 flex items-center gap-1.5">
                  🤝 Agency Commercial Tie-Up & Payout
                </h5>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">MOU / Tie-up Status</label>
                    <select
                      className="input text-xs"
                      value={specForm.mouStatus}
                      onChange={e => setSpecForm(f => ({ ...f, mouStatus: e.target.value }))}
                    >
                      <option value="direct_tie_up">🤝 Direct University Tie-up</option>
                      <option value="sub_agent_mou">📑 Sub-Agent MOU</option>
                      <option value="informal_tie_up">📞 Direct Campus Contact</option>
                      <option value="none">⭕ No Formal Tie-up</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">Commercial Commission (%)</label>
                    <input
                      type="number"
                      className="input text-sm"
                      value={specForm.commissionRate}
                      onChange={e => setSpecForm(f => ({ ...f, commissionRate: Number(e.target.value) }))}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Campus SPOC Name</label>
                    <input
                      type="text"
                      className="input text-sm"
                      placeholder="e.g. Dr. Rajesh Sharma"
                      value={specForm.contactPersonName}
                      onChange={e => setSpecForm(f => ({ ...f, contactPersonName: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="label">SPOC Contact Number</label>
                    <input
                      type="tel"
                      className="input text-sm"
                      placeholder="+91 98765 43210"
                      value={specForm.contactPersonPhone}
                      onChange={e => setSpecForm(f => ({ ...f, contactPersonPhone: e.target.value }))}
                    />
                  </div>
                </div>

                <div>
                  <label className="label">SPOC Email Address</label>
                  <input
                    type="email"
                    className="input text-sm"
                    placeholder="spoc.admissions@university.edu.in"
                    value={specForm.contactPersonEmail}
                    onChange={e => setSpecForm(f => ({ ...f, contactPersonEmail: e.target.value }))}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Admission Intake Status</label>
                    <select
                      className="input text-xs"
                      value={specForm.admissionStatus}
                      onChange={e => setSpecForm(f => ({ ...f, admissionStatus: e.target.value }))}
                    >
                      <option value="admissions_open">🟢 Admissions Open</option>
                      <option value="seats_fast_filling">🔥 Seats Fast Filling</option>
                      <option value="merit_closed_mgmt_open">⚡ Merit Closed (Mgmt Open)</option>
                      <option value="admissions_closed">🔴 Closed for Intake</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">Target Quota</label>
                    <select
                      className="input text-xs"
                      value={specForm.quotaType}
                      onChange={e => setSpecForm(f => ({ ...f, quotaType: e.target.value }))}
                    >
                      <option value="management_quota">Management Quota</option>
                      <option value="merit_counselling">Merit Counselling</option>
                      <option value="nri_quota">NRI / International Quota</option>
                      <option value="institutional_direct">Institutional Direct</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="modal-actions pt-2 flex justify-end gap-2 border-t border-slate-100">
                <button type="button" className="btn btn-ghost" onClick={() => setShowAddSpecModal(false)}>Cancel</button>
                <button type="submit" disabled={submitting} className="btn btn-primary">
                  {submitting ? 'Saving...' : 'Add Stream 🎯'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODAL 4: EDIT SPECIALIZATION FEE & TIE-UP STRUCTURE (UNIFIED)
         ───────────────────────────────────────────────────────────── */}
      {showEditCourseModal && editingCourse && (
        <div className="modal-overlay" onClick={() => setShowEditCourseModal(false)}>
          <div className="modal-sheet max-w-xl bg-white" onClick={e => e.stopPropagation()}>
            <div className="modal-handle" />
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-2xs shrink-0">
                  <Edit size={18} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 m-0">Customize Fee & Tie-Up Payout</h3>
                  <p className="text-xs text-slate-500 m-0 mt-0.5">
                    Configuring stream: <strong className="text-slate-800">{courseForm.specialization}</strong> ({courseForm.degreeName})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowEditCourseModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition text-lg leading-none"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSaveCourse} className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
              <div>
                <label className="label">Specialization Name *</label>
                <input
                  type="text"
                  className="input text-sm"
                  placeholder="e.g. Artificial Intelligence & Machine Learning"
                  value={courseForm.specialization}
                  onChange={e => setCourseForm(f => ({ ...f, specialization: e.target.value }))}
                  required
                />
              </div>

              {/* CARD 1: Student Fee Package Breakdown */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <h5 className="text-xs font-bold uppercase tracking-wider text-emerald-700 m-0 flex items-center gap-1.5">
                  💳 Student Fee Package Breakdown
                </h5>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Annual Tuition Fee (₹) *</label>
                    <input
                      type="number"
                      className="input text-sm"
                      value={courseForm.annualTuitionFee}
                      onChange={e => {
                        const annual = Number(e.target.value) || 0;
                        setCourseForm(f => ({
                          ...f,
                          annualTuitionFee: annual,
                          packageFee: annual * (editingCourse.durationYears || 4),
                        }));
                      }}
                      required
                    />
                  </div>
                  <div>
                    <label className="label">Total Package Deal (₹)</label>
                    <input
                      type="number"
                      className="input text-sm"
                      value={courseForm.packageFee}
                      onChange={e => setCourseForm(f => ({ ...f, packageFee: Number(e.target.value) }))}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Hostel Fee / Year (₹)</label>
                    <input
                      type="number"
                      className="input text-sm"
                      value={courseForm.hostelFeePerYear}
                      onChange={e => setCourseForm(f => ({ ...f, hostelFeePerYear: Number(e.target.value) }))}
                    />
                  </div>
                  <div>
                    <label className="label">One-Time Admission Fee (₹)</label>
                    <input
                      type="number"
                      className="input text-sm"
                      value={courseForm.oneTimeAdmissionFee}
                      onChange={e => setCourseForm(f => ({ ...f, oneTimeAdmissionFee: Number(e.target.value) }))}
                    />
                  </div>
                </div>

                <div>
                  <label className="label">Fee Notes / Scholarships</label>
                  <input
                    type="text"
                    className="input text-sm"
                    placeholder="e.g. 20% merit scholarship on 85%+ in 12th board"
                    value={courseForm.feeNotes}
                    onChange={e => setCourseForm(f => ({ ...f, feeNotes: e.target.value }))}
                  />
                </div>
              </div>

              {/* CARD 2: Agency Commercial Tie-Up & Payout */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <h5 className="text-xs font-bold uppercase tracking-wider text-indigo-700 m-0 flex items-center gap-1.5">
                  🤝 Agency Commercial Tie-Up & Payout
                </h5>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">MOU / Tie-up Status</label>
                    <select
                      className="input text-xs"
                      value={courseForm.mouStatus}
                      onChange={e => setCourseForm(f => ({ ...f, mouStatus: e.target.value }))}
                    >
                      <option value="direct_tie_up">🤝 Direct University Tie-up</option>
                      <option value="sub_agent_mou">📑 Sub-Agent MOU</option>
                      <option value="informal_tie_up">📞 Direct Campus Contact</option>
                      <option value="none">⭕ No Formal Tie-up</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">Commission Rate (%)</label>
                    <input
                      type="number"
                      className="input text-sm"
                      value={courseForm.commissionRate}
                      onChange={e => setCourseForm(f => ({ ...f, commissionRate: Number(e.target.value) }))}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Campus SPOC Name</label>
                    <input
                      type="text"
                      className="input text-sm"
                      placeholder="e.g. Dr. Rajesh Sharma"
                      value={courseForm.contactPersonName}
                      onChange={e => setCourseForm(f => ({ ...f, contactPersonName: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="label">SPOC Contact Number</label>
                    <input
                      type="tel"
                      className="input text-sm"
                      placeholder="+91 98765 43210"
                      value={courseForm.contactPersonPhone}
                      onChange={e => setCourseForm(f => ({ ...f, contactPersonPhone: e.target.value }))}
                    />
                  </div>
                </div>

                <div>
                  <label className="label">SPOC Email Address</label>
                  <input
                    type="email"
                    className="input text-sm"
                    placeholder="spoc.admissions@university.edu.in"
                    value={courseForm.contactPersonEmail}
                    onChange={e => setCourseForm(f => ({ ...f, contactPersonEmail: e.target.value }))}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Admission Intake Status</label>
                    <select
                      className="input text-xs"
                      value={courseForm.admissionStatus}
                      onChange={e => setCourseForm(f => ({ ...f, admissionStatus: e.target.value }))}
                    >
                      <option value="admissions_open">🟢 Admissions Open</option>
                      <option value="seats_fast_filling">🔥 Seats Fast Filling</option>
                      <option value="merit_closed_mgmt_open">⚡ Merit Closed (Mgmt Open)</option>
                      <option value="admissions_closed">🔴 Closed for Intake</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">Target Quota</label>
                    <select
                      className="input text-xs"
                      value={courseForm.quotaType}
                      onChange={e => setCourseForm(f => ({ ...f, quotaType: e.target.value }))}
                    >
                      <option value="management_quota">Management Quota</option>
                      <option value="merit_counselling">Merit Counselling</option>
                      <option value="nri_quota">NRI / International Quota</option>
                      <option value="institutional_direct">Institutional Direct</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="modal-actions pt-2 flex justify-end gap-2 border-t border-slate-100">
                <button type="button" className="btn btn-ghost" onClick={() => setShowEditCourseModal(false)}>Cancel</button>
                <button type="submit" disabled={submitting} className="btn btn-primary">
                  {submitting ? 'Saving...' : 'Save Fee & Tie-Up Settings ✅'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODAL: SEND FEE STRUCTURE ON WHATSAPP
         ───────────────────────────────────────────────────────────── */}
      <SendFeeStructureWhatsAppModal
        isOpen={showWhatsAppModal}
        onClose={() => {
          setShowWhatsAppModal(false);
          setSelectedCourseForWhatsApp(null);
          setSelectedDegreeForWhatsApp(null);
        }}
        college={college}
        degree={selectedDegreeForWhatsApp}
        course={selectedCourseForWhatsApp}
      />

      <BottomNav active="catalogue" />
    </div>
  );
}
