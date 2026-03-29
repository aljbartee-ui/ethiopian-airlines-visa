import { useState, useEffect, useRef } from 'react';
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
  Filter,
  Download,
  ArrowLeft,
  MapPin,
  Image as ImageIcon,
  Trash2
} from 'lucide-react';
import type { FormData } from '@/types';
import { AIRPORT_OPTIONS, DESTINATION_AIRPORTS } from '@/types';
import { getAllApplications, getApplicationDetails, updateApplicationStatus, deleteApplication, isSupabaseConfigured } from '@/lib/supabase';

const ADMIN_PASSWORD = 'ethiopian2024'; // In production, use proper authentication

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

// Helper function to determine trip direction
const getTripDirection = (destinationCode: string): { type: 'inbound' | 'outbound'; label: string; color: string } => {
  const inboundCodes = ['RUH', 'DMM', 'JED', 'MED', 'GIZ', 'KWI'];
  
  if (inboundCodes.includes(destinationCode)) {
    return { type: 'inbound', label: 'Inbound (Coming)', color: 'bg-blue-500/20 text-blue-400 border-blue-500/40' };
  }
  
  return { type: 'outbound', label: 'Outbound (Leaving)', color: 'bg-purple-500/20 text-purple-400 border-purple-500/40' };
};

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [submissions, setSubmissions] = useState<FormData[]>([]);
  const [filteredSubmissions, setFilteredSubmissions] = useState<FormData[]>([]);
  const [selectedSubmission, setSelectedSubmission] = useState<FormData | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [directionFilter, setDirectionFilter] = useState<string>('all');
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [viewingDocument, setViewingDocument] = useState<{type: string, url: string, name: string} | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  // Ref prevents a second concurrent fetch from starting while one is in-flight
  const fetchingRef = useRef(false);

  // On mount: restore session, then load once
  useEffect(() => {
    const authStatus = sessionStorage.getItem('adminAuthenticated');
    if (authStatus === 'true') {
      setIsAuthenticated(true);
    }
    // Single initial load — no polling loop
    loadSubmissions();
  }, []);

  useEffect(() => {
    filterSubmissions();
  }, [submissions, searchTerm, statusFilter, directionFilter]);

  const loadSubmissions = async () => {
    // Prevent concurrent fetches — if one is already in-flight, skip
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    setIsLoading(true);
    try {
      const data = await getAllApplications();
      setSubmissions(data);
    } catch (error) {
      console.error('Error loading submissions:', error);
      toast.error('Failed to load applications');
    } finally {
      fetchingRef.current = false;
      setIsLoading(false);
    }
  };

  const filterSubmissions = () => {
    let filtered = [...submissions];
    
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(s => 
        s.id.toLowerCase().includes(term) ||
        s.passengers.some(p => 
          p.fullName.toLowerCase().includes(term) ||
          p.passportNumber.toLowerCase().includes(term) ||
          p.nationality.toLowerCase().includes(term)
        )
      );
    }
    
    if (statusFilter !== 'all') {
      filtered = filtered.filter(s => s.status === statusFilter);
    }

    if (directionFilter !== 'all') {
      filtered = filtered.filter(s => getTripDirection(s.destinationAirportCode).type === directionFilter);
    }
    
    setFilteredSubmissions(filtered);
  };

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

  const updateStatus = async (id: string, newStatus: FormData['status']) => {
    try {
      await updateApplicationStatus(id, newStatus);
      const updated = submissions.map(s => 
        s.id === id ? { ...s, status: newStatus } : s
      );
      setSubmissions(updated);
      toast.success(`Status updated to ${STATUS_LABELS[newStatus]}`);
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Failed to update status');
    }
  };

  const viewDetails = async (submission: FormData) => {
    // First, set the basic submission data
    setSelectedSubmission(submission);
    setIsDetailOpen(true);
    
    // Then fetch full details including images in the background
    try {
      console.log('Fetching full application details...');
      const fullDetails = await getApplicationDetails(submission.id);
      if (fullDetails) {
        setSelectedSubmission(fullDetails);
        console.log('Full application details loaded');
      }
    } catch (error) {
      console.error('Error fetching full details:', error);
      // Continue with the basic submission data if full details fail to load
    }
  };

  const deleteSubmission = async (id: string) => {
    if (confirm('Are you sure you want to delete this application? This action cannot be undone.')) {
      try {
        await deleteApplication(id);
        const updated = submissions.filter(s => s.id !== id);
        setSubmissions(updated);
        toast.success('Application deleted successfully');
      } catch (error) {
        console.error('Error deleting application:', error);
        toast.error('Failed to delete application');
      }
    }
  };

  const exportToCSV = () => {
    const headers = [
      'ID',
      'Submission Date',
      'Status',
      'Travel Type',
      'Transit Airport',
      'Destination Airport',
      'Destination Code',
      'Destination City',
      'Destination Country',
      'Land Transport',
      'Passenger Count',
      'Passenger Names',
      'Nationalities',
      'Passport Numbers',
      'Contact Numbers',
      'Group Contact',
      'Group Contact Number',
    ];

    const rows = submissions.map(s => {
      const destAirport = DESTINATION_AIRPORTS.find(a => a.code === s.destinationAirportCode);
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
        passengers.map(p => p.fullName).join('; '),
        passengers.map(p => p.nationality).join('; '),
        passengers.map(p => p.passportNumber).join('; '),
        passengers.map(p => p.contactNumber).join('; '),
        s.groupContactName || '',
        s.groupContactNumber || '',
      ];
    });

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ethiopian-airlines-visa-applications-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    
    toast.success('Applications exported to CSV');
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#1a1a1a] flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-[#2a2a2a] border-white/10">
          <CardHeader className="text-center">
            {/* Ethiopian Airlines Branding */}
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
            <p className="text-white/50 text-sm mt-2">Ethiopian Airlines Kuwait Office</p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              {/* Hidden username field required by browser accessibility/password-manager spec */}
              <input
                type="text"
                name="username"
                autoComplete="username"
                value="admin"
                readOnly
                aria-hidden="true"
                className="hidden"
              />
              <div>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter admin password"
                  className="bg-[#1a1a1a] border-white/20 text-white placeholder:text-white/40"
                  autoComplete="current-password"
                  required
                />
              </div>
              <Button
                type="submit"
                className="w-full bg-[#FEDD00] hover:bg-[#e5cc00] text-black font-bold"
              >
                Login
              </Button>
            </form>
            <Button
              onClick={() => navigate('/')}
              variant="ghost"
              className="w-full mt-4 text-white/60 hover:text-white"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#1a1a1a]">
      {/* Ethiopian Airlines Branding Bar */}
      <div className="bg-[#006341]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex gap-1">
                <div className="w-2 h-2 rounded-full bg-[#006341] border border-white/30"></div>
                <div className="w-2 h-2 rounded-full bg-[#FEDD00]"></div>
                <div className="w-2 h-2 rounded-full bg-[#DA020E]"></div>
              </div>
              <span className="text-white font-bold text-sm tracking-wide">
                ETHIOPIAN AIRLINES
              </span>
            </div>
            <div className="flex items-center gap-2 text-white/90 text-xs">
              <MapPin className="w-3 h-3" />
              <span>Kuwait Office</span>
            </div>
          </div>
        </div>
      </div>
      <div className="flex h-1">
        <div className="flex-1 bg-[#006341]"></div>
        <div className="flex-1 bg-[#FEDD00]"></div>
        <div className="flex-1 bg-[#DA020E]"></div>
      </div>

      {/* Header */}
      <header className="bg-[#2a2a2a] border-b border-white/10 sticky top-[25px] z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4">
              <Button
                onClick={() => navigate('/')}
                variant="ghost"
                size="sm"
                className="text-white/60 hover:text-white"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <h1 
                className="text-xl font-bold text-white"
                style={{ fontFamily: 'Montserrat, sans-serif' }}
              >
                Admin <span className="text-[#FEDD00]">Dashboard</span>
              </h1>
            </div>
            <div className="flex items-center gap-3">
              {/* Connection Status */}
              <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs ${isSupabaseConfigured() ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                <div className={`w-2 h-2 rounded-full ${isSupabaseConfigured() ? 'bg-green-400 animate-pulse' : 'bg-yellow-400'}`}></div>
                {isSupabaseConfigured() ? 'Cloud Sync' : 'Local Mode'}
              </div>
              <Button
                onClick={exportToCSV}
                variant="outline"
                size="sm"
                className="border-white/20 text-white hover:bg-white/10"
              >
                <Download className="w-4 h-4 mr-2" />
                Export CSV
              </Button>
              <Button
                onClick={handleLogout}
                variant="ghost"
                size="sm"
                className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Stats */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {[
            { label: 'Total', value: submissions.length, color: 'text-white' },
            { label: 'Pending', value: submissions.filter(s => s.status === 'pending').length, color: 'text-yellow-400' },
            { label: 'Processing', value: submissions.filter(s => s.status === 'processing').length, color: 'text-blue-400' },
            { label: 'Approved', value: submissions.filter(s => s.status === 'approved').length, color: 'text-green-400' },
            { label: 'Rejected', value: submissions.filter(s => s.status === 'rejected').length, color: 'text-red-400' },
            { label: 'Completed', value: submissions.filter(s => s.status === 'completed').length, color: 'text-purple-400' },
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
              className="pl-10 bg-[#2a2a2a] border-white/20 text-white placeholder:text-white/40"
            />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Filter className="w-4 h-4 text-white/40" />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px] bg-[#2a2a2a] border-white/20 text-white">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent className="bg-[#2a2a2a] border-white/20">
                <SelectItem value="all" className="text-white hover:bg-white/10">All Status</SelectItem>
                {Object.entries(STATUS_LABELS).map(([value, label]) => (
                  <SelectItem 
                    key={value} 
                    value={value}
                    className="text-white hover:bg-white/10"
                  >
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={directionFilter} onValueChange={setDirectionFilter}>
              <SelectTrigger className="w-[170px] bg-[#2a2a2a] border-white/20 text-white">
                <SelectValue placeholder="Filter by direction" />
              </SelectTrigger>
              <SelectContent className="bg-[#2a2a2a] border-white/20">
                <SelectItem value="all" className="text-white hover:bg-white/10">All Directions</SelectItem>
                <SelectItem value="inbound" className="text-blue-400 hover:bg-white/10">Inbound (Coming)</SelectItem>
                <SelectItem value="outbound" className="text-purple-400 hover:bg-white/10">Outbound (Leaving)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Applications List */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
        {isLoading && submissions.length === 0 ? (
          <Card className="bg-[#2a2a2a] border-white/10">
            <CardContent className="p-12 text-center">
              <div className="w-8 h-8 border-2 border-[#FEDD00]/40 border-t-[#FEDD00] rounded-full animate-spin mx-auto mb-4" />
              <p className="text-white/50">Loading applications...</p>
            </CardContent>
          </Card>
        ) : filteredSubmissions.length === 0 ? (
          <Card className="bg-[#2a2a2a] border-white/10">
            <CardContent className="p-12 text-center">
              <FileText className="w-12 h-12 text-white/20 mx-auto mb-4" />
              <p className="text-white/50">No applications found</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredSubmissions.map((submission) => (
              <Card 
                key={submission.id} 
                className="bg-[#2a2a2a] border-white/10 hover:border-[#FEDD00]/30 transition-colors"
              >
                <CardContent className="p-4 sm:p-6">
                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                    {/* Left: Basic Info */}
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <span className="font-mono text-[#FEDD00]">
                          #{submission.id.slice(0, 8).toUpperCase()}
                        </span>
                        <Badge 
                          variant="outline" 
                          className={STATUS_COLORS[submission.status]}
                        >
                          {STATUS_LABELS[submission.status]}
                        </Badge>
                        {(() => {
                          const dir = getTripDirection(submission.destinationAirportCode);
                          return (
                            <Badge variant="outline" className={dir.color}>
                              {dir.label}
                            </Badge>
                          );
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
                        {submission.passengers.map(p => p.fullName).join(', ')}
                      </div>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex flex-wrap items-center gap-2">
                      <Select
                        value={submission.status}
                        onValueChange={(value) => updateStatus(submission.id, value as FormData['status'])}
                      >
                        <SelectTrigger className="w-[140px] bg-[#1a1a1a] border-white/20 text-white text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-[#2a2a2a] border-white/20">
                          {Object.entries(STATUS_LABELS).map(([value, label]) => (
                            <SelectItem 
                              key={value} 
                              value={value}
                              className="text-white hover:bg-white/10"
                            >
                              {label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      
                      <Button
                        onClick={() => viewDetails(submission)}
                        variant="outline"
                        size="sm"
                        className="border-white/20 text-white hover:bg-white/10"
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        View
                      </Button>
                      
                      <Button
                        onClick={() => deleteSubmission(submission.id)}
                        variant="outline"
                        size="sm"
                        className="border-red-500/50 text-red-400 hover:bg-red-500/10 hover:text-red-300"
                      >
                        <Trash2 className="w-4 h-4 mr-1" />
                        Delete
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
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
              <img 
                src={viewingDocument.url} 
                alt={viewingDocument.type}
                className="w-full h-auto max-h-[70vh] object-contain rounded-lg"
              />
              <div className="mt-4 flex justify-center">
                <a
                  href={viewingDocument.url}
                  download={viewingDocument.name}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-[#FEDD00] text-black rounded-lg font-medium hover:bg-[#e5cc00] transition-colors"
                >
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
            <DialogTitle className="text-xl" style={{ fontFamily: 'Montserrat, sans-serif' }}>
              Application Details
            </DialogTitle>
            <p className="text-white/50 text-sm">Ethiopian Airlines Kuwait Office</p>
          </DialogHeader>
          
          {selectedSubmission && (
            <div className="space-y-6">
              {/* Header Info */}
              <div className="flex flex-wrap items-center gap-3">
                <span className="font-mono text-[#FEDD00] text-lg">
                  #{selectedSubmission.id.slice(0, 8).toUpperCase()}
                </span>
                <Badge 
                  variant="outline" 
                  className={STATUS_COLORS[selectedSubmission.status]}
                >
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

              {/* Transit Info */}
              <div>
                <h3 className="text-lg font-semibold text-[#FEDD00] mb-3">Transit Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-white/50">Transit Airport:</span>
                    <p>
                      {AIRPORT_OPTIONS.find(a => a.code === selectedSubmission.transitAirport)?.name} 
                      ({selectedSubmission.transitAirport})
                    </p>
                  </div>
                  <div>
                    <span className="text-white/50">Land Transportation:</span>
                    <p>{selectedSubmission.needsLandTransport ? 'Requested' : 'Not Needed'}</p>
                  </div>
                </div>
              </div>

              <Separator className="bg-white/10" />

              {/* Destination Info */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-semibold text-[#FEDD00]">Final Destination</h3>
                  {(() => {
                    const tripDirection = getTripDirection(selectedSubmission.destinationAirportCode);
                    return (
                      <Badge variant="outline" className={`${tripDirection.color} border`}>
                        {tripDirection.label}
                      </Badge>
                    );
                  })()}
                </div>
                <div className="grid grid-cols-1 gap-2">
                  <div>
                    <span className="text-white/50">Airport:</span>
                    <p>
                      {selectedSubmission.destinationAirportCode === 'OTHER' 
                        ? selectedSubmission.customDestinationAirport 
                        : DESTINATION_AIRPORTS.find(a => a.code === selectedSubmission.destinationAirportCode)?.name || 'Unknown'}
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
                          <p>{DESTINATION_AIRPORTS.find(a => a.code === selectedSubmission.destinationAirportCode)?.city || 'Unknown'}</p>
                        </div>
                        <div>
                          <span className="text-white/50">Country:</span>
                          <p>{DESTINATION_AIRPORTS.find(a => a.code === selectedSubmission.destinationAirportCode)?.country || 'Unknown'}</p>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <Separator className="bg-white/10" />

              {/* Group Info */}
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

              {/* Passengers */}
              <div>
                <h3 className="text-lg font-semibold text-[#FEDD00] mb-3">
                  Passengers ({selectedSubmission.passengers.length})
                </h3>
                <div className="space-y-4">
                  {selectedSubmission.passengers.map((passenger, index) => (
                    <div key={passenger.id} className="bg-[#1a1a1a] rounded-lg p-4">
                      <h4 className="font-medium mb-2">Passenger {index + 1}</h4>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <span className="text-white/50">Full Name:</span>
                          <p>{passenger.fullName}</p>
                        </div>
                        <div>
                          <span className="text-white/50">Nationality:</span>
                          <p>{passenger.nationality}</p>
                        </div>
                        <div>
                          <span className="text-white/50">Passport:</span>
                          <p>{passenger.passportNumber}</p>
                        </div>
                        <div>
                          <span className="text-white/50">Contact:</span>
                          <p>{passenger.contactNumber}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <Separator className="bg-white/10" />

              {/* Documents - Per Passenger */}
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
                            <button
                              onClick={() => setViewingDocument({
                                type: 'Civil ID',
                                url: passenger.civilIdFile!,
                                name: passenger.civilIdFileName || 'civil-id.jpg'
                              })}
                              className="w-full h-24 rounded-lg overflow-hidden border-2 border-green-500/50 hover:border-green-500 transition-colors relative group"
                            >
                              <img 
                                src={passenger.civilIdFile} 
                                alt="Civil ID" 
                                className="w-full h-full object-cover"
                              />
                              <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <Eye className="w-6 h-6 text-white" />
                              </div>
                            </button>
                          ) : (
                            <div className="h-24 rounded-lg flex items-center justify-center bg-[#1a1a1a]">
                              <X className="w-8 h-8 text-white/20" />
                            </div>
                          )}
                          <p className="text-sm mt-2">Civil ID</p>
                        </div>

                        {/* Passport */}
                        <div className="text-center">
                          {passenger.passportFile ? (
                            <button
                              onClick={() => setViewingDocument({
                                type: 'Passport',
                                url: passenger.passportFile!,
                                name: passenger.passportFileName || 'passport.jpg'
                              })}
                              className="w-full h-24 rounded-lg overflow-hidden border-2 border-green-500/50 hover:border-green-500 transition-colors relative group"
                            >
                              <img 
                                src={passenger.passportFile} 
                                alt="Passport" 
                                className="w-full h-full object-cover"
                              />
                              <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <Eye className="w-6 h-6 text-white" />
                              </div>
                            </button>
                          ) : (
                            <div className="h-24 rounded-lg flex items-center justify-center bg-[#1a1a1a]">
                              <X className="w-8 h-8 text-white/20" />
                            </div>
                          )}
                          <p className="text-sm mt-2">Passport</p>
                        </div>

                        {/* Photo */}
                        <div className="text-center">
                          {passenger.photoFile ? (
                            <button
                              onClick={() => setViewingDocument({
                                type: 'Photo',
                                url: passenger.photoFile!,
                                name: passenger.photoFileName || 'photo.jpg'
                              })}
                              className="w-full h-24 rounded-lg overflow-hidden border-2 border-green-500/50 hover:border-green-500 transition-colors relative group"
                            >
                              <img 
                                src={passenger.photoFile} 
                                alt="Photo" 
                                className="w-full h-full object-cover"
                              />
                              <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <Eye className="w-6 h-6 text-white" />
                              </div>
                            </button>
                          ) : (
                            <div className="h-24 rounded-lg flex items-center justify-center bg-[#1a1a1a]">
                              <span className="text-white/20 text-xs">Optional</span>
                            </div>
                          )}
                          <p className="text-sm mt-2">Photo</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* WhatsApp Link */}
              <div className="pt-4">
                {(() => {
                  // Get the contact number based on travel type
                  const contactNumber = selectedSubmission.travelType !== 'individual' && selectedSubmission.groupContactNumber
                    ? selectedSubmission.groupContactNumber
                    : selectedSubmission.passengers[0]?.contactNumber;
                  
                  // Format the number for WhatsApp (remove any non-digit characters except +)
                  const formattedNumber = contactNumber?.replace(/[^\d+]/g, '') || '';
                  
                  return (
                    <a
                      href={`https://wa.me/${formattedNumber}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block"
                    >
                      <Button className="w-full bg-green-600 hover:bg-green-700 text-white">
                        Open WhatsApp to Contact
                      </Button>
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
