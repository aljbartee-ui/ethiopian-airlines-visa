import { useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Plane, ArrowDown, MapPin } from 'lucide-react';
import gsap from 'gsap';

export default function Hero() {
  const heroRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const subheadingRef = useRef<HTMLParagraphElement>(null);
  const ctaRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      // Heading animation
      gsap.fromTo(
        headingRef.current,
        { y: 100, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.8, delay: 0.2, ease: 'power3.out' }
      );

      // Subheading animation
      gsap.fromTo(
        subheadingRef.current,
        { x: -50, opacity: 0 },
        { x: 0, opacity: 1, duration: 0.6, delay: 0.4, ease: 'power2.out' }
      );

      // CTA animation
      gsap.fromTo(
        ctaRef.current,
        { scale: 0.8, opacity: 0 },
        { scale: 1, opacity: 1, duration: 0.5, delay: 0.6, ease: 'back.out(1.7)' }
      );

      // Image parallax zoom
      gsap.fromTo(
        imageRef.current,
        { scale: 1.1 },
        { scale: 1, duration: 1.5, ease: 'power2.out' }
      );
    }, heroRef);

    return () => ctx.revert();
  }, []);

  const scrollToForm = () => {
    const formSection = document.getElementById('application-form');
    if (formSection) {
      formSection.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <section
      ref={heroRef}
      className="relative min-h-screen flex items-center justify-center overflow-hidden"
    >
      {/* Background Image */}
      <div
        ref={imageRef}
        className="absolute inset-0 z-0"
        style={{
          backgroundImage: `url('/hero-bg.jpg')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      />

      {/* Dark Overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/60 to-black/85 z-[1]" />

      {/* Ethiopian Airlines Branding Bar */}
      <div className="absolute top-0 left-0 right-0 z-20">
        <div className="bg-[#006341]">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {/* Ethiopian Airlines Logo Colors */}
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full bg-[#006341]"></div>
                  <div className="w-3 h-3 rounded-full bg-[#FEDD00]"></div>
                  <div className="w-3 h-3 rounded-full bg-[#DA020E]"></div>
                </div>
                <span className="text-white font-bold text-sm sm:text-base tracking-wide">
                  ETHIOPIAN AIRLINES
                </span>
              </div>
              <div className="flex items-center gap-2 text-white/90 text-xs sm:text-sm">
                <MapPin className="w-4 h-4 text-[#FEDD00]" />
                <span>Kuwait Office</span>
              </div>
            </div>
          </div>
        </div>
        {/* Color Strip */}
        <div className="flex h-1">
          <div className="flex-1 bg-[#006341]"></div>
          <div className="flex-1 bg-[#FEDD00]"></div>
          <div className="flex-1 bg-[#DA020E]"></div>
        </div>
      </div>

      {/* Content */}
      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center pt-20">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 bg-[#006341]/30 border border-[#FEDD00]/50 rounded-full px-4 py-2 mb-8">
          <Plane className="w-4 h-4 text-[#FEDD00]" />
          <span className="text-[#FEDD00] text-sm font-medium">
            Alternative Travel Solution
          </span>
        </div>

        {/* Main Heading */}
        <h1
          ref={headingRef}
          className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-white mb-6 tracking-tight"
          style={{ fontFamily: 'Montserrat, sans-serif' }}
        >
          KUWAIT AIRPORT
          <span className="block text-[#FEDD00]">CLOSED?</span>
        </h1>

        {/* Subheading */}
        <p
          ref={subheadingRef}
          className="text-xl sm:text-2xl md:text-3xl text-white/90 mb-6 font-semibold"
          style={{ fontFamily: 'Montserrat, sans-serif' }}
        >
          We Facilitate Saudi Transit Visa Process
        </p>

        {/* Description */}
        <p className="text-base sm:text-lg text-white/70 max-w-2xl mx-auto mb-10 leading-relaxed">
          Kuwait Airport is currently closed. Ethiopian Airlines Kuwait Office is here to help 
          facilitate your Saudi transit visa. 
          Travel seamlessly via our Saudi transit points.
        </p>

        {/* CTA Button */}
        <div ref={ctaRef} className="relative inline-block">
          {/* Radar pulse effect */}
          <div className="absolute inset-0 rounded-lg bg-[#FEDD00] animate-ping opacity-40" style={{ animationDuration: '4s' }} />
          
          <Button
            onClick={scrollToForm}
            size="lg"
            className="relative bg-[#FEDD00] hover:bg-[#e5cc00] text-black font-bold text-lg px-8 py-6 rounded-lg transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-[#FEDD00]/30"
          >
            Start Application
            <ArrowDown className="ml-2 w-5 h-5" />
          </Button>
        </div>

        {/* Transit Airports Preview */}
        <div className="mt-16 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4 max-w-4xl mx-auto">
          {[
            { code: 'DMM', name: 'Dammam' },
            { code: 'RUH', name: 'Riyadh' },
            { code: 'MED', name: 'Medina' },
            { code: 'JED', name: 'Jeddah' },
            { code: 'GIZ', name: 'Jizan' },
          ].map((airport, index) => (
            <div
              key={airport.code}
              className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg p-3 text-center hover:bg-[#006341]/40 hover:border-[#FEDD00]/50 transition-all duration-300"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <span className="text-[#FEDD00] font-bold text-lg">{airport.code}</span>
              <span className="block text-white/70 text-xs">{airport.name}</span>
            </div>
          ))}
        </div>

        {/* Footer Note */}
        <div className="mt-12 text-white/50 text-sm">
          <p>Ethiopian Airlines Kuwait Office • Facilitating Your Travel Needs</p>
        </div>
      </div>

      {/* Scroll Indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10">
        <div className="flex flex-col items-center gap-2 text-white/50">
          <span className="text-xs uppercase tracking-wider">Scroll Down</span>
          <ArrowDown className="w-5 h-5 animate-bounce" />
        </div>
      </div>
    </section>
  );
}
