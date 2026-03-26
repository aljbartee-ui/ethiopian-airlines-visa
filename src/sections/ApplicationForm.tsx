import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { 
  User, 
  Users, 
  Plane, 
  Bus, 
  Upload, 
  FileText, 
  Image as ImageIcon, 
  CreditCard,
  Check,
  Plus,
  Trash2,
  MessageCircle,
  Download,
  Send,
  MapPin,
  Search,
  X
} from 'lucide-react';
import type { FormData, Passenger } from '@/types';
import { createApplication } from '@/lib/supabase';
import { 
  AIRPORT_OPTIONS, 
  AFRICAN_NATIONALITIES,
  OTHER_NATIONALITIES,
  DESTINATION_AIRPORTS,
  WHATSAPP_NUMBER 
} from '@/types';
import { v4 as uuidv4 } from 'uuid';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

const initialPassenger: Passenger = {
  id: '',
  fullName: '',
  nationality: '',
  passportNumber: '',
  contactNumber: '',
  civilIdFile: undefined,
  civilIdFileName: undefined,
  passportFile: undefined,
  passportFileName: undefined,
  photoFile: undefined,
  photoFileName: undefined,
};

const initialFormData: Omit<FormData, 'id' | 'submissionDate'> = {
  status: 'pending',
  travelType: 'individual',
  groupContactName: '',
  groupContactNumber: '',
  numberOfPassengers: 1,
  passengers: [{ ...initialPassenger, id: uuidv4() }],
  transitAirport: '',
  destinationAirportCode: '',
  customDestinationAirport: '',
  needsLandTransport: false,
};

export default function ApplicationForm() {
  const [formData, setFormData] = useState<Omit<FormData, 'id' | 'submissionDate'>>(initialFormData);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [submittedData, setSubmittedData] = useState<FormData | null>(null);
  const formRef = useRef<HTMLDivElement>(null);

  const handleTravelTypeChange = (value: 'individual' | 'family' | 'group') => {
    setFormData(prev => ({
      ...prev,
      travelType: value,
      passengers: value === 'individual' 
        ? [{ ...initialPassenger, id: uuidv4() }]
        : prev.passengers,
      numberOfPassengers: value === 'individual' ? 1 : prev.numberOfPassengers,
    }));
  };

  const handlePassengerChange = (index: number, field: keyof Passenger, value: string) => {
    setFormData(prev => ({
      ...prev,
      passengers: prev.passengers.map((p, i) => 
        i === index ? { ...p, [field]: value } : p
      ),
    }));
  };

  const addPassenger = () => {
    setFormData(prev => ({
      ...prev,
      passengers: [...prev.passengers, { ...initialPassenger, id: uuidv4() }],
      numberOfPassengers: (prev.numberOfPassengers || 1) + 1,
    }));
  };

  const removePassenger = (index: number) => {
    if (formData.passengers.length <= 1) {
      toast.error('At least one passenger is required');
      return;
    }
    setFormData(prev => ({
      ...prev,
      passengers: prev.passengers.filter((_, i) => i !== index),
      numberOfPassengers: (prev.numberOfPassengers || 1) - 1,
    }));
  };

  const handleFileUpload = (passengerIndex: number, field: 'civilIdFile' | 'passportFile' | 'photoFile', file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size must be less than 5MB');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setFormData(prev => ({
        ...prev,
        passengers: prev.passengers.map((p, i) => 
          i === passengerIndex 
            ? {
                ...p,
                [field]: reader.result as string,
                [`${field}Name`]: file.name,
              }
            : p
        ),
      }));
      toast.success(`${file.name} uploaded successfully for passenger ${passengerIndex + 1}`);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (!formData.transitAirport) {
      toast.error('Please select a transit airport');
      return;
    }

    if (!formData.destinationAirportCode) {
      toast.error('Please select a destination airport');
      return;
    }

    if (formData.destinationAirportCode === 'OTHER' && !formData.customDestinationAirport) {
      toast.error('Please enter the airport details');
      return;
    }

    for (let i = 0; i < formData.passengers.length; i++) {
      const passenger = formData.passengers[i];
      if (!passenger.fullName || !passenger.nationality || !passenger.passportNumber || !passenger.contactNumber) {
        toast.error(`Please fill in all details for passenger ${i + 1}`);
        return;
      }
      if (!passenger.civilIdFile) {
        toast.error(`Please upload Kuwait Civil ID for passenger ${i + 1}`);
        return;
      }
      if (!passenger.passportFile) {
        toast.error(`Please upload passport for passenger ${i + 1}`);
        return;
      }
    }

    setIsSubmitting(true);

    try {
      // Create application using Supabase (or localStorage as fallback)
      const newSubmission = await createApplication(formData);

      setSubmittedData(newSubmission);
      setShowSuccess(true);
      toast.success('Application submitted successfully!');
    } catch (error) {
      console.error('Error submitting application:', error);
      toast.error('Failed to submit application. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const generateWhatsAppLink = () => {
    if (!submittedData) return '#';
    
    const message = `Hello Ethiopian Airlines Kuwait Office, I have submitted my transit visa application (ID: ${submittedData.id.slice(0, 8)}). Please find my application details attached.`;
    return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
  };

  const downloadFormPDF = async () => {
    if (!formRef.current) return;
    
    try {
      const canvas = await html2canvas(formRef.current, {
        scale: 2,
        backgroundColor: '#1a1a1a',
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Transit_Visa_Application_${submittedData?.id.slice(0, 8)}.pdf`);
      
      toast.success('Form downloaded successfully!');
    } catch (error) {
      toast.error('Failed to download form');
    }
  };

  if (showSuccess && submittedData) {
    return (
      <section id="application-form" className="py-20 px-4 sm:px-6 lg:px-8 bg-[#1a1a1a]">
        <div className="max-w-3xl mx-auto">
          <Card className="bg-[#2a2a2a] border-[#FEDD00]/30">
            <CardContent className="p-8 text-center">
              {/* Ethiopian Airlines Branding */}
              <div className="flex items-center justify-center gap-2 mb-6">
                <div className="w-3 h-3 rounded-full bg-[#006341]"></div>
                <div className="w-3 h-3 rounded-full bg-[#FEDD00]"></div>
                <div className="w-3 h-3 rounded-full bg-[#DA020E]"></div>
              </div>
              
              <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                <Check className="w-10 h-10 text-green-500" />
              </div>
              
              <h2 className="text-3xl font-bold text-white mb-4" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                Application Submitted!
              </h2>
              
              <p className="text-white/70 mb-2">
                Your application ID: <span className="text-[#FEDD00] font-mono">{submittedData.id.slice(0, 8).toUpperCase()}</span>
              </p>
              
              <p className="text-white/60 mb-8">
                Please save this ID for your records.
              </p>

              <div className="space-y-4">
                <Button
                  onClick={downloadFormPDF}
                  variant="outline"
                  className="w-full border-[#FEDD00] text-[#FEDD00] hover:bg-[#FEDD00] hover:text-black"
                >
                  <Download className="mr-2 w-5 h-5" />
                  Download Application Form
                </Button>
                
                <a
                  href={generateWhatsAppLink()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block"
                >
                  <Button
                    className="w-full bg-green-600 hover:bg-green-700 text-white"
                  >
                    <MessageCircle className="mr-2 w-5 h-5" />
                    Send to WhatsApp ({WHATSAPP_NUMBER})
                  </Button>
                </a>
              </div>

              <div className="mt-8 p-4 bg-[#006341]/20 border border-[#006341]/50 rounded-lg">
                <p className="text-white/80 text-sm">
                  <strong className="text-[#FEDD00]">Next Steps:</strong> Ethiopian Airlines Kuwait Office will facilitate 
                  your Saudi transit visa. Download your form and send it to our 
                  WhatsApp number along with your documents.
                </p>
              </div>

              <div className="mt-4 flex items-center justify-center gap-2 text-white/50 text-sm">
                <MapPin className="w-4 h-4" />
                <span>Ethiopian Airlines Kuwait Office</span>
              </div>

              <Button
                onClick={() => {
                  setShowSuccess(false);
                  setSubmittedData(null);
                  setFormData(initialFormData);
                }}
                variant="ghost"
                className="mt-6 text-white/60 hover:text-white"
              >
                Submit Another Application
              </Button>
            </CardContent>
          </Card>

          {/* Hidden form for PDF generation */}
          <div ref={formRef} className="absolute -left-[9999px] p-8 bg-[#1a1a1a] text-white" style={{ width: '800px' }}>
            {/* Ethiopian Airlines Header */}
            <div className="flex items-center justify-between mb-6 pb-4 border-b-2 border-[#FEDD00]">
              <div className="flex items-center gap-2">
                <div className="flex gap-1">
                  <div className="w-4 h-4 rounded-full bg-[#006341]"></div>
                  <div className="w-4 h-4 rounded-full bg-[#FEDD00]"></div>
                  <div className="w-4 h-4 rounded-full bg-[#DA020E]"></div>
                </div>
                <span className="text-white font-bold text-lg">ETHIOPIAN AIRLINES</span>
              </div>
              <div className="text-white/70 text-sm">Kuwait Office</div>
            </div>

            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-[#FEDD00] mb-2">Saudi Transit Visa Application</h1>
              <p className="text-white/70">Facilitated by Ethiopian Airlines Kuwait Office</p>
            </div>

            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-white/60">Application ID:</span>
                  <p className="font-mono">{submittedData.id.slice(0, 8).toUpperCase()}</p>
                </div>
                <div>
                  <span className="text-white/60">Submission Date:</span>
                  <p>{new Date(submittedData.submissionDate).toLocaleDateString()}</p>
                </div>
              </div>

              <div>
                <span className="text-white/60">Travel Type:</span>
                <p className="capitalize">{submittedData.travelType}</p>
              </div>

              {submittedData.travelType !== 'individual' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-white/60">Group Contact:</span>
                    <p>{submittedData.groupContactName}</p>
                  </div>
                  <div>
                    <span className="text-white/60">Group Contact Number:</span>
                    <p>{submittedData.groupContactNumber}</p>
                  </div>
                </div>
              )}

              <div>
                <span className="text-white/60">Transit Airport:</span>
                <p>{AIRPORT_OPTIONS.find(a => a.code === submittedData.transitAirport)?.name} ({submittedData.transitAirport})</p>
              </div>

              <div>
                <span className="text-white/60">Final Destination:</span>
                <p>
                  {submittedData.destinationAirportCode === 'OTHER' 
                    ? submittedData.customDestinationAirport 
                    : DESTINATION_AIRPORTS.find(a => a.code === submittedData.destinationAirportCode)?.name} 
                  ({submittedData.destinationAirportCode})
                </p>
              </div>

              <div>
                <span className="text-white/60">Land Transportation:</span>
                <p>{submittedData.needsLandTransport ? 'Yes - Requested' : 'No - Not Needed'}</p>
              </div>

              <Separator className="bg-white/20" />

              <h3 className="text-xl font-bold text-[#FEDD00]">Passenger Details</h3>
              
              {submittedData.passengers.map((passenger, index) => (
                <div key={passenger.id} className="border border-white/20 rounded-lg p-4">
                  <h4 className="font-semibold mb-3">Passenger {index + 1}</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-white/60">Full Name:</span>
                      <p>{passenger.fullName}</p>
                    </div>
                    <div>
                      <span className="text-white/60">Nationality:</span>
                      <p>{passenger.nationality}</p>
                    </div>
                    <div>
                      <span className="text-white/60">Passport Number:</span>
                      <p>{passenger.passportNumber}</p>
                    </div>
                    <div>
                      <span className="text-white/60">Contact Number:</span>
                      <p>{passenger.contactNumber}</p>
                    </div>
                  </div>
                </div>
              ))}

              <Separator className="bg-white/20" />

              <h3 className="text-xl font-bold text-[#FEDD00]">Submitted Documents</h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <div className={`w-full h-32 border-2 rounded-lg flex items-center justify-center ${submittedData.civilIdFile ? 'border-green-500 bg-green-500/10' : 'border-white/20'}`}>
                    {submittedData.civilIdFile ? <Check className="w-8 h-8 text-green-500" /> : <span className="text-white/40">Not Uploaded</span>}
                  </div>
                  <p className="mt-2 text-sm">Civil ID</p>
                </div>
                <div className="text-center">
                  <div className={`w-full h-32 border-2 rounded-lg flex items-center justify-center ${submittedData.passportFile ? 'border-green-500 bg-green-500/10' : 'border-white/20'}`}>
                    {submittedData.passportFile ? <Check className="w-8 h-8 text-green-500" /> : <span className="text-white/40">Not Uploaded</span>}
                  </div>
                  <p className="mt-2 text-sm">Passport</p>
                </div>
                <div className="text-center">
                  <div className={`w-full h-32 border-2 rounded-lg flex items-center justify-center ${submittedData.photoFile ? 'border-green-500 bg-green-500/10' : 'border-white/20'}`}>
                    {submittedData.photoFile ? <Check className="w-8 h-8 text-green-500" /> : <span className="text-white/40">Optional</span>}
                  </div>
                  <p className="mt-2 text-sm">Photo (Optional)</p>
                </div>
              </div>

              <div className="mt-8 pt-4 border-t border-white/20 text-center text-white/50 text-sm">
                <p>Ethiopian Airlines Kuwait Office • WhatsApp: {WHATSAPP_NUMBER}</p>
                <p className="mt-1">We facilitate Saudi transit visa applications.</p>
              </div>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section id="application-form" className="py-20 px-4 sm:px-6 lg:px-8 bg-[#1a1a1a]">
      <div className="max-w-4xl mx-auto">
        {/* Ethiopian Airlines Branding */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-3 h-3 rounded-full bg-[#006341]"></div>
          <div className="w-3 h-3 rounded-full bg-[#FEDD00]"></div>
          <div className="w-3 h-3 rounded-full bg-[#DA020E]"></div>
          <span className="text-white/70 text-sm ml-2">Ethiopian Airlines Kuwait Office</span>
        </div>

        {/* Section Header */}
        <div className="text-center mb-12">
          <h2 
            className="text-3xl sm:text-4xl font-bold text-white mb-4"
            style={{ fontFamily: 'Montserrat, sans-serif' }}
          >
            Saudi Transit Visa <span className="text-[#FEDD00]">Application</span>
          </h2>
          <p className="text-white/60 max-w-2xl mx-auto">
            Ethiopian Airlines Kuwait Office will facilitate your Saudi transit visa. 
            Complete the form below to get started.
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Travel Type Selection */}
          <Card className="bg-[#2a2a2a] border-white/10 mb-6">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-[#FEDD00]" />
                Travel Type
              </CardTitle>
            </CardHeader>
            <CardContent>
              <RadioGroup
                value={formData.travelType}
                onValueChange={(value) => handleTravelTypeChange(value as 'individual' | 'family' | 'group')}
                className="grid grid-cols-1 sm:grid-cols-3 gap-4"
              >
                {[
                  { value: 'individual', label: 'Individual', icon: User },
                  { value: 'family', label: 'Family', icon: Users },
                  { value: 'group', label: 'Group', icon: Users },
                ].map((option) => (
                  <div key={option.value}>
                    <RadioGroupItem
                      value={option.value}
                      id={option.value}
                      className="peer sr-only"
                    />
                    <Label
                      htmlFor={option.value}
                      className="flex flex-col items-center justify-center p-4 border-2 border-white/20 rounded-lg cursor-pointer transition-all duration-300 peer-data-[state=checked]:border-[#FEDD00] peer-data-[state=checked]:bg-[#FEDD00]/10 hover:border-white/40"
                    >
                      <option.icon className="w-8 h-8 mb-2 text-white/60 peer-data-[state=checked]:text-[#FEDD00]" />
                      <span className="text-white font-medium">{option.label}</span>
                    </Label>
                  </div>
                ))}
              </RadioGroup>

              {/* Group/Family Contact Fields - Only show if not individual */}
              {formData.travelType !== 'individual' && (
                <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4 animate-in slide-in-from-top-2 duration-300">
                  <div>
                    <Label htmlFor="groupContactName" className="text-white/80">
                      {formData.travelType === 'family' ? 'Family' : 'Group'} Contact Name *
                    </Label>
                    <Input
                      id="groupContactName"
                      value={formData.groupContactName}
                      onChange={(e) => setFormData(prev => ({ ...prev, groupContactName: e.target.value }))}
                      placeholder="Enter contact name"
                      className="mt-1 bg-[#1a1a1a] border-white/20 text-white placeholder:text-white/40"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="groupContactNumber" className="text-white/80">
                      {formData.travelType === 'family' ? 'Family' : 'Group'} Contact Number *
                    </Label>
                    <Input
                      id="groupContactNumber"
                      value={formData.groupContactNumber}
                      onChange={(e) => setFormData(prev => ({ ...prev, groupContactNumber: e.target.value }))}
                      placeholder="Enter contact number"
                      className="mt-1 bg-[#1a1a1a] border-white/20 text-white placeholder:text-white/40"
                      required
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Transit Airport Selection */}
          <Card className="bg-[#2a2a2a] border-white/10 mb-6">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Plane className="w-5 h-5 text-[#FEDD00]" />
                Transit Airport (Saudi Arabia)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {AIRPORT_OPTIONS.map((airport) => (
                  <div
                    key={airport.code}
                    onClick={() => setFormData(prev => ({ ...prev, transitAirport: airport.code }))}
                    className={`p-4 border-2 rounded-lg cursor-pointer transition-all duration-300 ${
                      formData.transitAirport === airport.code
                        ? 'border-[#FEDD00] bg-[#FEDD00]/10'
                        : 'border-white/20 hover:border-white/40'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[#FEDD00] font-bold text-lg">{airport.code}</span>
                      {formData.transitAirport === airport.code && (
                        <Check className="w-5 h-5 text-[#FEDD00]" />
                      )}
                    </div>
                    <p className="text-white font-medium">{airport.name}</p>
                    <p className="text-white/50 text-sm">{airport.flightNumbers}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Destination Airport - Searchable Dropdown */}
          <DestinationAirportSelector 
            value={formData.destinationAirportCode}
            customValue={formData.customDestinationAirport || ''}
            onChange={(code) => setFormData(prev => ({ ...prev, destinationAirportCode: code }))}
            onCustomChange={(value) => setFormData(prev => ({ ...prev, customDestinationAirport: value }))}
          />

          {/* Land Transportation Option */}
          <Card className="bg-[#2a2a2a] border-white/10 mb-6">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Bus className="w-5 h-5 text-[#FEDD00]" />
                Land Transportation
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-start space-x-3">
                <Checkbox
                  id="landTransport"
                  checked={formData.needsLandTransport}
                  onCheckedChange={(checked) => 
                    setFormData(prev => ({ ...prev, needsLandTransport: checked as boolean }))
                  }
                  className="mt-1 border-white/40 data-[state=checked]:bg-[#FEDD00] data-[state=checked]:border-[#FEDD00]"
                />
                <div>
                  <Label htmlFor="landTransport" className="text-white font-medium cursor-pointer">
                    I need land transportation between Kuwait and the selected Saudi airport
                  </Label>
                  <p className="text-white/50 text-sm mt-1">
                    Ethiopian Airlines can help arrange ground transportation. Additional fees may apply.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Passenger Details */}
          <Card className="bg-[#2a2a2a] border-white/10 mb-6">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-white flex items-center gap-2">
                <User className="w-5 h-5 text-[#FEDD00]" />
                Passenger Details
              </CardTitle>
              {formData.travelType !== 'individual' && (
                <Button
                  type="button"
                  onClick={addPassenger}
                  variant="outline"
                  size="sm"
                  className="border-[#FEDD00] text-[#FEDD00] hover:bg-[#FEDD00] hover:text-black"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add Passenger
                </Button>
              )}
            </CardHeader>
            <CardContent className="space-y-6">
              {formData.passengers.map((passenger, index) => (
                <div 
                  key={passenger.id} 
                  className="p-4 border border-white/10 rounded-lg relative"
                >
                  {formData.travelType !== 'individual' && (
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-[#FEDD00] font-semibold">
                        Passenger {index + 1}
                      </span>
                      <Button
                        type="button"
                        onClick={() => removePassenger(index)}
                        variant="ghost"
                        size="sm"
                        className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="sm:col-span-2">
                      <Label className="text-white/80">Full Name (as in Passport) *</Label>
                      <Input
                        value={passenger.fullName}
                        onChange={(e) => handlePassengerChange(index, 'fullName', e.target.value)}
                        placeholder="Enter full name"
                        className="mt-1 bg-[#1a1a1a] border-white/20 text-white placeholder:text-white/40"
                        required
                      />
                    </div>

                    <div>
                      <Label className="text-white/80">Nationality *</Label>
                      <Select
                        value={passenger.nationality}
                        onValueChange={(value) => handlePassengerChange(index, 'nationality', value)}
                      >
                        <SelectTrigger className="mt-1 bg-[#1a1a1a] border-white/20 text-white">
                          <SelectValue placeholder="Select nationality" />
                        </SelectTrigger>
                        <SelectContent className="bg-[#2a2a2a] border-white/20 max-h-[300px]">
                          <div className="px-2 py-1 text-xs text-[#FEDD00] font-semibold">
                            African Nationals
                          </div>
                          {AFRICAN_NATIONALITIES.map((nationality) => (
                            <SelectItem 
                              key={nationality} 
                              value={nationality}
                              className="text-white hover:bg-white/10 focus:bg-white/10 focus:text-white"
                            >
                              {nationality}
                            </SelectItem>
                          ))}
                          <div className="px-2 py-1 text-xs text-[#FEDD00] font-semibold mt-2">
                            Other Nationalities
                          </div>
                          {OTHER_NATIONALITIES.map((nationality) => (
                            <SelectItem 
                              key={nationality} 
                              value={nationality}
                              className="text-white hover:bg-white/10 focus:bg-white/10 focus:text-white"
                            >
                              {nationality}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label className="text-white/80">Passport Number *</Label>
                      <Input
                        value={passenger.passportNumber}
                        onChange={(e) => handlePassengerChange(index, 'passportNumber', e.target.value)}
                        placeholder="Enter passport number"
                        className="mt-1 bg-[#1a1a1a] border-white/20 text-white placeholder:text-white/40"
                        required
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <Label className="text-white/80">Contact Number *</Label>
                      <Input
                        value={passenger.contactNumber}
                        onChange={(e) => handlePassengerChange(index, 'contactNumber', e.target.value)}
                        placeholder="Enter contact number with country code"
                        className="mt-1 bg-[#1a1a1a] border-white/20 text-white placeholder:text-white/40"
                        required
                      />
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Document Upload - Per Passenger */}
          <Card className="bg-[#2a2a2a] border-white/10 mb-6">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <FileText className="w-5 h-5 text-[#FEDD00]" />
                Document Upload
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-8">
                {formData.passengers.map((passenger, passengerIndex) => (
                  <div key={passenger.id} className="p-4 border border-white/10 rounded-lg">
                    <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                      <FileText className="w-4 h-4 text-[#FEDD00]" />
                      Documents for {passenger.fullName || `Passenger ${passengerIndex + 1}`}
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      {/* Civil ID Upload */}
                      <div>
                        <Label className="text-white/80 flex items-center gap-1">
                          <CreditCard className="w-4 h-4" />
                          Kuwait Civil ID *
                        </Label>
                        <div className="mt-2">
                          <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-white/30 rounded-lg cursor-pointer hover:border-[#FEDD00] hover:bg-[#FEDD00]/5 transition-all duration-300">
                            <div className="flex flex-col items-center justify-center pt-5 pb-6">
                              {passenger.civilIdFile ? (
                                <>
                                  <Check className="w-8 h-8 text-green-500 mb-2" />
                                  <p className="text-xs text-white/60 text-center px-2">{passenger.civilIdFileName}</p>
                                </>
                              ) : (
                                <>
                                  <Upload className="w-8 h-8 text-white/40 mb-2" />
                                  <p className="text-xs text-white/40">Click to upload</p>
                                </>
                              )}
                            </div>
                            <input
                              type="file"
                              className="hidden"
                              accept="image/*,.pdf"
                              onChange={(e) => e.target.files?.[0] && handleFileUpload(passengerIndex, 'civilIdFile', e.target.files[0])}
                            />
                          </label>
                        </div>
                      </div>

                      {/* Passport Upload */}
                      <div>
                        <Label className="text-white/80 flex items-center gap-1">
                          <FileText className="w-4 h-4" />
                          Passport *
                        </Label>
                        <div className="mt-2">
                          <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-white/30 rounded-lg cursor-pointer hover:border-[#FEDD00] hover:bg-[#FEDD00]/5 transition-all duration-300">
                            <div className="flex flex-col items-center justify-center pt-5 pb-6">
                              {passenger.passportFile ? (
                                <>
                                  <Check className="w-8 h-8 text-green-500 mb-2" />
                                  <p className="text-xs text-white/60 text-center px-2">{passenger.passportFileName}</p>
                                </>
                              ) : (
                                <>
                                  <Upload className="w-8 h-8 text-white/40 mb-2" />
                                  <p className="text-xs text-white/40">Click to upload</p>
                                </>
                              )}
                            </div>
                            <input
                              type="file"
                              className="hidden"
                              accept="image/*,.pdf"
                              onChange={(e) => e.target.files?.[0] && handleFileUpload(passengerIndex, 'passportFile', e.target.files[0])}
                            />
                          </label>
                        </div>
                      </div>

                      {/* Photo Upload (Optional) */}
                      <div>
                        <Label className="text-white/80 flex items-center gap-1">
                          <ImageIcon className="w-4 h-4" />
                          Photo <span className="text-white/40">(Optional)</span>
                        </Label>
                        <div className="mt-2">
                          <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-white/30 rounded-lg cursor-pointer hover:border-[#FEDD00] hover:bg-[#FEDD00]/5 transition-all duration-300">
                            <div className="flex flex-col items-center justify-center pt-5 pb-6">
                              {passenger.photoFile ? (
                                <>
                                  <Check className="w-8 h-8 text-green-500 mb-2" />
                                  <p className="text-xs text-white/60 text-center px-2">{passenger.photoFileName}</p>
                                </>
                              ) : (
                                <>
                                  <Upload className="w-8 h-8 text-white/40 mb-2" />
                                  <p className="text-xs text-white/40">White background</p>
                                  <p className="text-xs text-white/30">Optional</p>
                                </>
                              )}
                            </div>
                            <input
                              type="file"
                              className="hidden"
                              accept="image/*"
                              onChange={(e) => e.target.files?.[0] && handleFileUpload(passengerIndex, 'photoFile', e.target.files[0])}
                            />
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Submit Button */}
          <div className="flex flex-col sm:flex-row gap-4">
            <Button
              type="submit"
              disabled={isSubmitting}
              size="lg"
              className="flex-1 bg-[#FEDD00] hover:bg-[#e5cc00] text-black font-bold py-6 transition-all duration-300 hover:scale-[1.02] disabled:opacity-50"
            >
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <span className="animate-spin">⟳</span>
                  Submitting...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Send className="w-5 h-5" />
                  Submit Application
                </span>
              )}
            </Button>
          </div>

          {/* Footer Note */}
          <div className="mt-6 text-center">
            <p className="text-white/40 text-sm">
              By submitting this form, you authorize Ethiopian Airlines Kuwait Office to facilitate 
              your Saudi transit visa.
            </p>
            <div className="mt-4 flex items-center justify-center gap-2 text-white/50 text-sm">
              <MapPin className="w-4 h-4" />
              <span>Ethiopian Airlines Kuwait Office • WhatsApp: {WHATSAPP_NUMBER}</span>
            </div>
          </div>
        </form>
      </div>
    </section>
  );
}

// Destination Airport Selector Component
interface DestinationAirportSelectorProps {
  value: string;
  customValue: string;
  onChange: (code: string) => void;
  onCustomChange: (value: string) => void;
}

function DestinationAirportSelector({ value, customValue, onChange, onCustomChange }: DestinationAirportSelectorProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Get selected airport details
  const selectedAirport = DESTINATION_AIRPORTS.find(a => a.code === value);
  const isOtherSelected = value === 'OTHER';

  // Filter airports based on search term
  const filteredAirports = searchTerm.length >= 1
    ? DESTINATION_AIRPORTS.filter(airport => 
        airport.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        airport.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        airport.city.toLowerCase().includes(searchTerm.toLowerCase()) ||
        airport.country.toLowerCase().includes(searchTerm.toLowerCase())
      ).slice(0, 10) // Limit to 10 results
    : [];

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (code: string) => {
    onChange(code);
    setSearchTerm('');
    setIsOpen(false);
  };

  const handleClear = () => {
    onChange('');
    onCustomChange('');
    setSearchTerm('');
  };

  return (
    <Card className="bg-[#2a2a2a] border-white/10 mb-6">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <Plane className="w-5 h-5 text-[#FEDD00]" />
          Final Destination
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div ref={containerRef} className="relative">
          <Label className="text-white/80 mb-2 block">
            Search by City, Airport Name, or Code *
          </Label>
          
          {selectedAirport ? (
            // Selected Airport Display
            <div className="flex items-center gap-3 p-4 bg-[#006341]/30 border border-[#FEDD00]/50 rounded-lg">
              <div className="flex-shrink-0 w-12 h-12 bg-[#FEDD00] rounded-lg flex items-center justify-center">
                <span className="text-black font-bold text-sm">{selectedAirport.code}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-medium truncate">{selectedAirport.name}</p>
                <p className="text-white/60 text-sm">{selectedAirport.city}, {selectedAirport.country}</p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleClear}
                className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          ) : (
            // Search Input
            <div className="relative">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setIsOpen(e.target.value.length >= 1);
                }}
                onFocus={() => searchTerm.length >= 1 && setIsOpen(true)}
                placeholder="Type city name, airport name, or code (e.g. ADD, Addis Ababa, KWI)"
                className="w-full px-4 py-3 bg-[#1a1a1a] border border-white/20 rounded-lg text-white placeholder:text-white/40 focus:outline-none focus:border-[#FEDD00] focus:ring-1 focus:ring-[#FEDD00]"
              />
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
            </div>
          )}

          {/* Custom Airport Input (when OTHER is selected) */}
          {isOtherSelected && (
            <div className="mt-4">
              <Label className="text-white/80 mb-2 block">
                Enter Airport Details *
              </Label>
              <Input
                value={customValue}
                onChange={(e) => onCustomChange(e.target.value)}
                placeholder="e.g. Kuwait International Airport (KWI)"
                className="bg-[#1a1a1a] border-white/20 text-white placeholder:text-white/40"
                required
              />
            </div>
          )}

          {/* Dropdown Results */}
          {isOpen && filteredAirports.length > 0 && (
            <div className="absolute z-50 w-full mt-2 bg-[#2a2a2a] border border-white/20 rounded-lg shadow-xl max-h-[300px] overflow-y-auto">
              {filteredAirports.map((airport) => (
                <button
                  key={airport.code}
                  type="button"
                  onClick={() => handleSelect(airport.code)}
                  className="w-full px-4 py-3 text-left hover:bg-[#006341]/30 transition-colors border-b border-white/10 last:border-b-0"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex-shrink-0 w-10 h-10 bg-[#FEDD00]/20 rounded flex items-center justify-center">
                      <span className="text-[#FEDD00] font-bold text-xs">{airport.code}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-medium text-sm truncate">{airport.name}</p>
                      <p className="text-white/50 text-xs">{airport.city}, {airport.country}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* No Results */}
          {isOpen && searchTerm.length >= 1 && filteredAirports.length === 0 && (
            <div className="absolute z-50 w-full mt-2 bg-[#2a2a2a] border border-white/20 rounded-lg shadow-xl p-4 text-center">
              <p className="text-white/50 text-sm">No airports found. Try another search.</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
