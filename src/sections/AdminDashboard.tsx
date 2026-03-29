import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import {
  Lock,
  LogOut,
  Eye,
  Users,
  Plane,
  Bus,
  FileText,
  X,
  Search,
  Download,
  ArrowLeft,
  Image as ImageIcon,
  Trash2,
  RefreshCw,
  ChevronDown,
} from 'lucide-react';
import type { FormData } from '@/types';
import { AIRPORT_OPTIONS, DESTINATION_AIRPORTS } from '@/types';
import {
  getApplicationsPage,
  getApplicationDetails,
  updateApplicationStatus,
  deleteApplication,
  isSupabaseConfigured,
  SupabaseFetchError,
  PAGE_SIZE,
} from '@/lib/supabase';

const ADMIN_PASSWORD = 'ethiopian2024';

const STATUS_COLORS = {
  pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40',
  processing: 'bg-blue-500/20 text-blue-400 border-blue-500/40',
  approved: 'bg-green-500/20 text-green-400 border-green-500/40',
  rejected: 'bg-red-500/20 text-red-400 border-red-500/40',
  completed: 'bg-purple-500/20 text-purple-400 border-purple-500/40',
};

const STATUS_LABELS = {
  pending: 'Pending',
  processing: 'Processing',
  approved: 'Approved',
  rejected: 'Rejected',
  completed: 'Completed',
};

const getTripDirection = (destinationCode: string): { type: 'inbound' | 'outbound'; label: string; color: string } => {
  const inboundCodes = ['RUH', 'DMM', 'JED', 'MED', 'GIZ', 'KWI'];
  if (inboundCodes.includes(destinationCode)) {
    return { type: 'inbound', label: 'Inbound (Coming)', color: 'bg-blue-500/20 text-blue-400 border-blue-500/40' };
  }
  return { type: 'outbound', label: 'Outbound (Leaving)', color: 'bg-purple-500/20 text-purple-400 border-purple-500/40' };
};

export default function AdminDashboard() {
  const navigate = useNavigate();

  // ── Auth ──────────────────────────────────────────────────────────────
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');

  // ── Data ──────────────────────────────────────────────────────────────
  // All records loaded so far (accumulates across pages)
  const [submissions, setSubmissions] = useState<FormData[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  // ── Loading / error state ─────────────────────────────────────────────
  const [isLoadingFirst, setIsLoadingFirst] = useState(false);  // first page spinner
  const [isLoadingMore, setIsLoadingMore] = useState(false);    // "Load More" spinner
  const [fetchError, setFetchError] = useState<string | null>(null);
  const fetchingRef = useRef(false);

  // ── Filters ───────────────────────────────────────────────────────────
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [directionFilter, setDirectionFilter] = useState<string>('all');

  // ── Detail / document dialogs ─────────────────────────────────────────
  const [selectedSubmission, setSelectedSubmission] = useState<FormData | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [viewingDocument, setViewingDocument] = useState<{ type: string; url: string; name: string } | null>(null);

  // ── Restore session on mount ──────────────────────────────────────────
  useEffect(() => {
    const authStatus = sessionStorage.getItem('adminAuthenticated');
    if (authStatus === 'true') setIsAuthenticated(true);
    loadPage(0, true);
  }, []);

  // ── Core paginated fetch ──────────────────────────────────────────────
  const loadPage = useCallback(async (page: number, isFirstLoad: boolean) => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    setFetchError(null);

    if (isFirstLoad) {
      setIsLoadingFirst(true);
    } else {
      setIsLoadingMore(true);
    }

    try {
      const result = await getApplicationsPage(page, PAGE_SIZE);

      setTotalCount(result.total);
      setHasMore(result.hasMore);
      setCurrentPage(page);

      if (isFirstLoad) {
        // Replace — fresh load or refresh
        setSubmissions(result.items);
      } else {
        // Append — "Load More" clicked
        setSubmissions((prev) => [...prev, ...result.items]);
      }
    } catch (error) {
      if (error instanceof SupabaseFetchError) {
        const isNetworkError = error.message.toLowerCase().includes('failed to fetch');
        setFetchError(
          isNetworkError
            ? 'Cannot reach the database. The Supabase project may be paused — go to supabase.com/dashboard and click "Restore project", then retry.'
            : error.message
        );
        console.error('Supabase fetch error:', error.message, error.code);
      } else {
        setFetchError('An unexpected error occurred while loading applications.');
        console.error('Error loading submissions:', error);
      }
    } finally {
      fetchingRef.current = false;
      setIsLoadingFirst(false);
      setIsLoadingMore(false);
    }
  }, []);

  const handleRefresh = () => loadPage(0, true);
  const handleLoadMore = () => loadPage(currentPage + 1, false);

  // ── Filtered view (applied to already-loaded records) ─────────────────
  const filteredSubmissions = submissions.filter((s) => {
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const match =
        s.id.toLowerCase().includes(term) ||
        s.passengers.some(
          (p) =>
            p.fullName.toLowerCase().includes(term) ||
            p.passportNumber.toLowerCase().includes(term) ||
            p.nationality.toLowerCase().includes(term)
        );
      if (!match) return false;
    }
    if (statusFilter !== 'all' && s.status !== statusFilter) return false;
    if (directionFilter !== 'all' && getTripDirection(s.destinationAirportCode).type !== directionFilter) return false;
    return true;
  });

  // ── Auth handlers ─────────────────────────────────────────────────────
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === ADMIN_PASSWORD) {
      setIsAuthenticated(true);
      sessionStorage.setItem('adminAuthenticated', 'true');
      toast.success('Welcome to Ethiopian Airlines Kuwait Office Admin!');
    } else {
      toast.error('Incorrect password');
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    sessionStorage.removeItem('adminAuthenticated');
    setPassword('');
    toast.info('Logged out successfully');
  };

  // ── Data mutation handlers ─────────────────────────────────────────────
  const updateStatus = async (id: string, newStatus: FormData['status']) => {
    try {
      await updateApplicationStatus(id, newStatus);
      setSubmissions((prev) => prev.map((s) => (s.id === id ? { ...s, status: newStatus } : s)));
      toast.success(`Status updated to ${STATUS_LABELS[newStatus]}`);
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Failed to update status');
    }
  };

  const viewDetails = async (submission: FormData) => {
    setSelectedSubmission(submission);
    setIsDetailOpen(true);
    try {
      const fullDetails = await getApplicationDetails(submission.id);
      if (fullDetails) setSelectedSubmission(fullDetails);
    } catch (error) {
      console.error('Error fetching full details:', error);
    }
  };

  const deleteSubmission = async (id: string) => {
    if (confirm('Are you sure you want to delete this application? This action cannot be undone.')) {
      try {
        await deleteApplication(id);
        setSubmissions((prev) => prev.filter((s) => s.id !== id));
        setTotalCount((c) => c - 1);
        toast.success('Application deleted successfully');
      } catch (error) {
        console.error('Error deleting application:', error);
        toast.error('Failed to delete application');
      }
    }
  };

  const exportToCSV = () => {
    const headers = [
      'ID', 'Submission Date', 'Status', 'Travel Type', 'Transit Airport',
      'Destination Airport', 'Destination Code', 'Destination City', 'Destination Country',
      'Land Transport', 'Passenger Count', 'Passenger Names', 'Nationalities',
      'Passport Numbers', 'Contact Numbers', 'Group Contact', 'Group Contact Number',
    ];
    const rows = submissions.map((s) => {
      const destAirport = DESTINATION_AIRPORTS.find((a) => a.code === s.destinationAirportCode);
      const isOther = s.destinationAirportCode === 'OTHER';
      const passengers = s.passengers || [];
      return [
        s.id,
        new Date(s.submissionDate).toLocaleDateString(),
        s.status,
        s.travelType,
        s.transitAirport,
        isOther ? s.customDestinationAirport : (destAirport?.name || ''),
        s.destinationAirportCode || '',
        isOther ? '' : (destAirport?.city || ''),
        isOther ? '' : (destAirport?.country || ''),
        s.needsLandTransport ? 'Yes' : 'No',
        passengers.length,
        passengers.map((p) => p.fullName).join('; '),
        passengers.map((p) => p.nationality).join('; '),
        passengers.map((p) => p.passportNumber).join('; '),
        passengers.map((p) => p.contactNumber).join('; '),
        s.groupContactName || '',
        s.groupContactNumber || '',
      ];
    });
    const csvContent = [headers.join(','), ...rows.map((row) => row.map((cell) => `"${cell}"`).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ethiopian-airlines-visa-applications-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    toast.success('Applications exported to CSV');
  };

  // ── Login screen ──────────────────────────────────────────────────────
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#1a1a1a] flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-[#2a2a2a] border-white/10">
          <CardHeader className="text-center">
            <div className="flex items-center justify-center gap-2 mb-4">
              <div className="w-3 h-3 rounded-full bg-[#006341]"></div>
              <div className="w-3 h-3 rounded-full bg-[#FEDD00]"></div>
              <div className="w-3 h-3 rounded-full bg-[#DA020E]"></div>
            </div>
            <div className="w-16 h-16 bg-[#FEDD00]/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Lock className="w-8 h-8 text-[#FEDD00]" />
            </div>
            <CardTitle className="text-2xl text-white" style={{ fontFamily: 'Montserrat, sans-serif' }}>
              Admin Access
            </CardTitle>
            <p className="text-white/50 text-sm">Ethiopian Airlines Kuwait Office</p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              {/* Hidden username for password-manager accessibility */}
              <input
                type="text"
                name="username"
                autoComplete="username"
                value="admin"
                readOnly
                aria-hidden="true"
                className="hidden"
              />
              <Input
                type="password"
                placeholder="Enter admin password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                className="bg-[#1a1a1a] border-white/20 text-white placeholder:text-white/30"
              />
              <Button type="submit" className="w-full bg-[#FEDD00] text-black hover:bg-[#e5cc00] font-semibold">
                Login
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full text-white/50 hover:text-white"
                onClick={() => navigate('/')}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Home
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Dashboard ─────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#1a1a1a] text-white">
      {/* Header */}
      <header className="bg-[#006341] border-b border-white/10 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img
                src="/ethiopian-logo.png"
                alt="Ethiopian Airlines"
                className="h-8 object-contain"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
              <span className="text-white font-bold text-sm tracking-wide" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                ETHIOPIAN AIRLINES
              </span>
            </div>
            <span className="text-white/70 text-sm hidden sm:block">Kuwait Office</span>
          </div>
        </div>
      </header>

      {/* Sub-header */}
      <div className="bg-[#1a1a1a] border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4">
              <Button onClick={() => navigate('/')} variant="ghost" size="sm" className="text-white/60 hover:text-white">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <h1 className="text-xl font-bold text-white" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                Admin <span className="text-[#FEDD00]">Dashboard</span>
              </h1>
            </div>
            <div className="flex items-center gap-3">
              {/* Connection status */}
              <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs ${isSupabaseConfigured() ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                <div className={`w-2 h-2 rounded-full ${isSupabaseConfigured() ? 'bg-green-400 animate-pulse' : 'bg-yellow-400'}`}></div>
                {isSupabaseConfigured() ? 'Cloud Sync' : 'Local Mode'}
              </div>
              <Button onClick={handleRefresh} variant="outline" size="sm" className="border-white/20 text-white hover:bg-white/10" disabled={isLoadingFirst}>
                <RefreshCw className={`w-4 h-4 mr-2 ${isLoadingFirst ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button onClick={exportToCSV} variant="outline" size="sm" className="border-white/20 text-white hover:bg-white/10">
                <Download className="w-4 h-4 mr-2" />
                Export CSV
              </Button>
              <Button onClick={handleLogout} variant="ghost" size="sm" className="text-red-400 hover:text-red-300 hover:bg-red-500/10">
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Stats — based on loaded records */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {[
            { label: 'Total', value: totalCount, color: 'text-white' },
            { label: 'Pending', value: submissions.filter((s) => s.status === 'pending').length, color: 'text-yellow-400' },
            { label: 'Processing', value: submissions.filter((s) => s.status === 'processing').length, color: 'text-blue-400' },
            { label: 'Approved', value: submissions.filter((s) => s.status === 'approved').length, color: 'text-green-400' },
            { label: 'Rejected', value: submissions.filter((s) => s.status === 'rejected').length, color: 'text-red-400' },
            { label: 'Completed', value: submissions.filter((s) => s.status === 'completed').length, color: 'text-purple-400' },
          ].map((stat) => (
            <Card key={stat.label} className="bg-[#2a2a2a] border-white/10">
              <CardContent className="p-4 text-center">
                <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
                <p className="text-white/50 text-sm">{stat.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by name, passport, or ID..."
              className="pl-9 bg-[#2a2a2a] border-white/20 text-white placeholder:text-white/30"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[160px] bg-[#2a2a2a] border-white/20 text-white">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent className="bg-[#2a2a2a] border-white/20">
              <SelectItem value="all" className="text-white hover:bg-white/10">All Status</SelectItem>
              {Object.entries(STATUS_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value} className="text-white hover:bg-white/10">{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={directionFilter} onValueChange={setDirectionFilter}>
            <SelectTrigger className="w-full sm:w-[180px] bg-[#2a2a2a] border-white/20 text-white">
              <SelectValue placeholder="All Directions" />
            </SelectTrigger>
            <SelectContent className="bg-[#2a2a2a] border-white/20">
              <SelectItem value="all" className="text-white hover:bg-white/10">All Directions</SelectItem>
              <SelectItem value="inbound" className="text-blue-400 hover:bg-white/10">Inbound (Coming)</SelectItem>
              <SelectItem value="outbound" className="text-purple-400 hover:bg-white/10">Outbound (Leaving)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {/* Loaded count indicator */}
        {submissions.length > 0 && (
          <p className="text-white/30 text-xs mt-3">
            Showing {filteredSubmissions.length} of {submissions.length} loaded
            {totalCount > submissions.length ? ` · ${totalCount - submissions.length} more available` : ' · all loaded'}
          </p>
        )}
      </div>

      {/* Applications list */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
        {/* First-page loading spinner */}
        {isLoadingFirst ? (
          <Card className="bg-[#2a2a2a] border-white/10">
            <CardContent className="p-12 text-center">
              <div className="w-8 h-8 border-2 border-[#FEDD00]/40 border-t-[#FEDD00] rounded-full animate-spin mx-auto mb-4" />
              <p className="text-white/50">Loading applications…</p>
            </CardContent>
          </Card>

        ) : fetchError ? (
          /* Error state */
          <Card className="bg-[#2a2a2a] border-red-500/30">
            <CardContent className="p-12 text-center">
              <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
                <X className="w-6 h-6 text-red-400" />
              </div>
              <p className="text-red-400 font-semibold mb-2">Failed to load applications</p>
              <p className="text-white/40 text-sm mb-6 max-w-md mx-auto">{fetchError}</p>
              <Button onClick={handleRefresh} variant="outline" className="border-[#FEDD00]/40 text-[#FEDD00] hover:bg-[#FEDD00]/10">
                <RefreshCw className="w-4 h-4 mr-2" />
                Retry
              </Button>
            </CardContent>
          </Card>

        ) : filteredSubmissions.length === 0 ? (
          /* Empty state */
          <Card className="bg-[#2a2a2a] border-white/10">
            <CardContent className="p-12 text-center">
              <FileText className="w-12 h-12 text-white/20 mx-auto mb-4" />
              <p className="text-white/50">
                {submissions.length === 0 ? 'No applications found' : 'No applications match your filters'}
              </p>
            </CardContent>
          </Card>

        ) : (
          <>
            <div className="space-y-4">
              {filteredSubmissions.map((submission) => (
                <Card key={submission.id} className="bg-[#2a2a2a] border-white/10 hover:border-[#FEDD00]/30 transition-colors">
                  <CardContent className="p-4 sm:p-6">
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                      {/* Left: Basic Info */}
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <span className="font-mono text-[#FEDD00]">#{submission.id.slice(0, 8).toUpperCase()}</span>
                          <Badge variant="outline" className={STATUS_COLORS[submission.status]}>
                            {STATUS_LABELS[submission.status]}
                          </Badge>
                          {(() => {
                            const dir = getTripDirection(submission.destinationAirportCode);
                            return <Badge variant="outline" className={dir.color}>{dir.label}</Badge>;
                          })()}
                          <span className="text-white/40 text-sm">
                            {new Date(submission.submissionDate).toLocaleDateString()}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-4 text-sm">
                          <span className="flex items-center gap-1 text-white/70">
                            <Users className="w-4 h-4" />
                            {submission.passengers.length} {submission.travelType === 'individual' ? 'Passenger' : 'Passengers'}
                          </span>
                          <span className="flex items-center gap-1 text-white/70">
                            <Plane className="w-4 h-4" />
                            {submission.transitAirport}
                          </span>
                          {submission.needsLandTransport && (
                            <span className="flex items-center gap-1 text-[#FEDD00]">
                              <Bus className="w-4 h-4" />
                              Transport
                            </span>
                          )}
                        </div>
                        <div className="mt-2 text-white/50 text-sm">
                          {submission.passengers.map((p) => p.fullName).join(', ')}
                        </div>
                      </div>

                      {/* Right: Actions */}
                      <div className="flex flex-wrap items-center gap-2">
                        <Select value={submission.status} onValueChange={(v) => updateStatus(submission.id, v as FormData['status'])}>
                          <SelectTrigger className="w-[140px] bg-[#1a1a1a] border-white/20 text-white text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-[#2a2a2a] border-white/20">
                            {Object.entries(STATUS_LABELS).map(([value, label]) => (
                              <SelectItem key={value} value={value} className="text-white hover:bg-white/10">{label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button onClick={() => viewDetails(submission)} variant="outline" size="sm" className="border-white/20 text-white hover:bg-white/10">
                          <Eye className="w-4 h-4 mr-1" />
                          View
                        </Button>
                        <Button onClick={() => deleteSubmission(submission.id)} variant="outline" size="sm" className="border-red-500/50 text-red-400 hover:bg-red-500/10 hover:text-red-300">
                          <Trash2 className="w-4 h-4 mr-1" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Load More button */}
            {hasMore && !searchTerm && statusFilter === 'all' && directionFilter === 'all' && (
              <div className="mt-6 text-center">
                <Button
                  onClick={handleLoadMore}
                  disabled={isLoadingMore}
                  variant="outline"
                  className="border-[#FEDD00]/40 text-[#FEDD00] hover:bg-[#FEDD00]/10 min-w-[160px]"
                >
                  {isLoadingMore ? (
                    <>
                      <div className="w-4 h-4 border-2 border-[#FEDD00]/40 border-t-[#FEDD00] rounded-full animate-spin mr-2" />
                      Loading…
                    </>
                  ) : (
                    <>
                      <ChevronDown className="w-4 h-4 mr-2" />
                      Load More ({totalCount - submissions.length} remaining)
                    </>
                  )}
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Document Viewer Dialog */}
      <Dialog open={!!viewingDocument} onOpenChange={() => setViewingDocument(null)}>
        <DialogContent className="max-w-4xl max-h-[95vh] overflow-y-auto bg-[#1a1a1a] border-white/20 text-white">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2" style={{ fontFamily: 'Montserrat, sans-serif' }}>
              <ImageIcon className="w-5 h-5 text-[#FEDD00]" />
              {viewingDocument?.type}
            </DialogTitle>
            <p className="text-white/50 text-sm">{viewingDocument?.name}</p>
          </DialogHeader>
          {viewingDocument && (
            <div className="mt-4">
              <img src={viewingDocument.url} alt={viewingDocument.type} className="w-full h-auto max-h-[70vh] object-contain rounded-lg" />
              <div className="mt-4 flex justify-center">
                <a href={viewingDocument.url} download={viewingDocument.name} className="inline-flex items-center gap-2 px-4 py-2 bg-[#FEDD00] text-black rounded-lg font-medium hover:bg-[#e5cc00] transition-colors">
                  <Download className="w-4 h-4" />
                  Download {viewingDocument.type}
                </a>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-[#2a2a2a] border-white/20 text-white">
          <DialogHeader>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full bg-[#006341]"></div>
              <div className="w-2 h-2 rounded-full bg-[#FEDD00]"></div>
              <div className="w-2 h-2 rounded-full bg-[#DA020E]"></div>
            </div>
            <DialogTitle className="text-xl" style={{ fontFamily: 'Montserrat, sans-serif' }}>Application Details</DialogTitle>
            <p className="text-white/50 text-sm">Ethiopian Airlines Kuwait Office</p>
          </DialogHeader>

          {selectedSubmission && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center gap-3">
                <span className="font-mono text-[#FEDD00] text-lg">#{selectedSubmission.id.slice(0, 8).toUpperCase()}</span>
                <Badge variant="outline" className={STATUS_COLORS[selectedSubmission.status]}>
                  {STATUS_LABELS[selectedSubmission.status]}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-white/50">Submission Date:</span>
                  <p>{new Date(selectedSubmission.submissionDate).toLocaleString()}</p>
                </div>
                <div>
                  <span className="text-white/50">Travel Type:</span>
                  <p className="capitalize">{selectedSubmission.travelType}</p>
                </div>
              </div>

              <Separator className="bg-white/10" />

              <div>
                <h3 className="text-lg font-semibold text-[#FEDD00] mb-3">Transit Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-white/50">Transit Airport:</span>
                    <p>{AIRPORT_OPTIONS.find((a) => a.code === selectedSubmission.transitAirport)?.name} ({selectedSubmission.transitAirport})</p>
                  </div>
                  <div>
                    <span className="text-white/50">Land Transportation:</span>
                    <p>{selectedSubmission.needsLandTransport ? 'Requested' : 'Not Needed'}</p>
                  </div>
                </div>
              </div>

              <Separator className="bg-white/10" />

              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-semibold text-[#FEDD00]">Final Destination</h3>
                  {(() => {
                    const dir = getTripDirection(selectedSubmission.destinationAirportCode);
                    return <Badge variant="outline" className={`${dir.color} border`}>{dir.label}</Badge>;
                  })()}
                </div>
                <div className="grid grid-cols-1 gap-2">
                  <div>
                    <span className="text-white/50">Airport:</span>
                    <p>
                      {selectedSubmission.destinationAirportCode === 'OTHER'
                        ? selectedSubmission.customDestinationAirport
                        : DESTINATION_AIRPORTS.find((a) => a.code === selectedSubmission.destinationAirportCode)?.name || 'Unknown'}
                    </p>
                  </div>
                  <div className="flex gap-4">
                    <div>
                      <span className="text-white/50">Code:</span>
                      <p>{selectedSubmission.destinationAirportCode}</p>
                    </div>
                    {selectedSubmission.destinationAirportCode !== 'OTHER' && (
                      <>
                        <div>
                          <span className="text-white/50">City:</span>
                          <p>{DESTINATION_AIRPORTS.find((a) => a.code === selectedSubmission.destinationAirportCode)?.city || 'Unknown'}</p>
                        </div>
                        <div>
                          <span className="text-white/50">Country:</span>
                          <p>{DESTINATION_AIRPORTS.find((a) => a.code === selectedSubmission.destinationAirportCode)?.country || 'Unknown'}</p>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <Separator className="bg-white/10" />

              {selectedSubmission.travelType !== 'individual' && (
                <>
                  <div>
                    <h3 className="text-lg font-semibold text-[#FEDD00] mb-3">
                      {selectedSubmission.travelType === 'family' ? 'Family' : 'Group'} Contact
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <span className="text-white/50">Name:</span>
                        <p>{selectedSubmission.groupContactName}</p>
                      </div>
                      <div>
                        <span className="text-white/50">Contact:</span>
                        <p>{selectedSubmission.groupContactNumber}</p>
                      </div>
                    </div>
                  </div>
                  <Separator className="bg-white/10" />
                </>
              )}

              <div>
                <h3 className="text-lg font-semibold text-[#FEDD00] mb-3">Passengers ({selectedSubmission.passengers.length})</h3>
                <div className="space-y-4">
                  {selectedSubmission.passengers.map((passenger, index) => (
                    <div key={passenger.id} className="bg-[#1a1a1a] rounded-lg p-4">
                      <h4 className="font-medium mb-2">Passenger {index + 1}</h4>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div><span className="text-white/50">Full Name:</span><p>{passenger.fullName}</p></div>
                        <div><span className="text-white/50">Nationality:</span><p>{passenger.nationality}</p></div>
                        <div><span className="text-white/50">Passport:</span><p>{passenger.passportNumber}</p></div>
                        <div><span className="text-white/50">Contact:</span><p>{passenger.contactNumber}</p></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <Separator className="bg-white/10" />

              <div>
                <h3 className="text-lg font-semibold text-[#FEDD00] mb-3">Documents</h3>
                <div className="space-y-6">
                  {selectedSubmission.passengers.map((passenger, index) => (
                    <div key={passenger.id} className="p-4 border border-white/10 rounded-lg">
                      <h4 className="text-white font-semibold mb-3">{passenger.fullName || `Passenger ${index + 1}`}</h4>
                      <div className="grid grid-cols-3 gap-4">
                        {/* Civil ID */}
                        <div className="text-center">
                          {passenger.civilIdFile ? (
                            <button onClick={() => setViewingDocument({ type: 'Civil ID', url: passenger.civilIdFile!, name: passenger.civilIdFileName || 'civil-id.jpg' })} className="w-full h-24 rounded-lg overflow-hidden border-2 border-green-500/50 hover:border-green-500 transition-colors relative group">
                              <img src={passenger.civilIdFile} alt="Civil ID" className="w-full h-full object-cover" />
                              <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><Eye className="w-6 h-6 text-white" /></div>
                            </button>
                          ) : (
                            <div className="h-24 rounded-lg flex items-center justify-center bg-[#1a1a1a]"><X className="w-8 h-8 text-white/20" /></div>
                          )}
                          <p className="text-sm mt-2">Civil ID</p>
                        </div>
                        {/* Passport */}
                        <div className="text-center">
                          {passenger.passportFile ? (
                            <button onClick={() => setViewingDocument({ type: 'Passport', url: passenger.passportFile!, name: passenger.passportFileName || 'passport.jpg' })} className="w-full h-24 rounded-lg overflow-hidden border-2 border-green-500/50 hover:border-green-500 transition-colors relative group">
                              <img src={passenger.passportFile} alt="Passport" className="w-full h-full object-cover" />
                              <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><Eye className="w-6 h-6 text-white" /></div>
                            </button>
                          ) : (
                            <div className="h-24 rounded-lg flex items-center justify-center bg-[#1a1a1a]"><X className="w-8 h-8 text-white/20" /></div>
                          )}
                          <p className="text-sm mt-2">Passport</p>
                        </div>
                        {/* Photo */}
                        <div className="text-center">
                          {passenger.photoFile ? (
                            <button onClick={() => setViewingDocument({ type: 'Photo', url: passenger.photoFile!, name: passenger.photoFileName || 'photo.jpg' })} className="w-full h-24 rounded-lg overflow-hidden border-2 border-green-500/50 hover:border-green-500 transition-colors relative group">
                              <img src={passenger.photoFile} alt="Photo" className="w-full h-full object-cover" />
                              <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><Eye className="w-6 h-6 text-white" /></div>
                            </button>
                          ) : (
                            <div className="h-24 rounded-lg flex items-center justify-center bg-[#1a1a1a]"><span className="text-white/20 text-xs">Optional</span></div>
                          )}
                          <p className="text-sm mt-2">Photo</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-4">
                {(() => {
                  const contactNumber =
                    selectedSubmission.travelType !== 'individual' && selectedSubmission.groupContactNumber
                      ? selectedSubmission.groupContactNumber
                      : selectedSubmission.passengers[0]?.contactNumber;
                  const formattedNumber = contactNumber?.replace(/[^\d+]/g, '') || '';
                  return (
                    <a href={`https://wa.me/${formattedNumber}`} target="_blank" rel="noopener noreferrer" className="block">
                      <Button className="w-full bg-green-600 hover:bg-green-700 text-white">Open WhatsApp to Contact</Button>
                    </a>
                  );
                })()}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
