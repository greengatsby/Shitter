'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { 
  Star, 
  ArrowRight, 
  Users, 
  TrendingUp, 
  Target, 
  Calendar, 
  Check, 
  Menu, 
  X, 
  Zap, 
  BarChart3,
  ChevronDown,
  Mail,
  Phone,
  MapPin
} from "lucide-react"

export default function SocialBloomPage() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [openFAQ, setOpenFAQ] = useState<number | null>(null)

  const toggleFAQ = (index: number) => {
    setOpenFAQ(openFAQ === index ? null : index)
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 to-gray-900 text-white dark">
      {/* Header */}
      <header className="fixed w-full z-50 bg-gray-950/80 backdrop-blur-lg border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center">
              <Link href="/socialbloom" className="flex items-center">
                <div className="h-10 w-10 rounded-full bg-gradient-to-r from-purple-600 to-pink-600 flex items-center justify-center mr-3">
                  <span className="text-white font-bold text-xl">S</span>
                </div>
                <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-500">
                  SocialBloom
                </span>
              </Link>
            </div>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center space-x-8">
              <a href="#services" className="text-white/80 hover:text-white transition-colors">
                Services
              </a>
              <a href="#case-studies" className="text-white/80 hover:text-white transition-colors">
                Case Studies
              </a>
              <a href="#testimonials" className="text-white/80 hover:text-white transition-colors">
                Testimonials
              </a>
              <a href="#faq" className="text-white/80 hover:text-white transition-colors">
                FAQ
              </a>
              <Button className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700">
                Get Started
              </Button>
            </nav>

            {/* Mobile Menu Button */}
            <button 
              className="md:hidden text-white"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
              {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <div className="md:hidden bg-gray-900 border-t border-white/10">
            <div className="px-4 py-5 space-y-5">
              <a 
                href="#services" 
                className="block text-white/80 hover:text-white transition-colors"
                onClick={() => setIsMenuOpen(false)}
              >
                Services
              </a>
              <a 
                href="#case-studies" 
                className="block text-white/80 hover:text-white transition-colors"
                onClick={() => setIsMenuOpen(false)}
              >
                Case Studies
              </a>
              <a 
                href="#testimonials" 
                className="block text-white/80 hover:text-white transition-colors"
                onClick={() => setIsMenuOpen(false)}
              >
                Testimonials
              </a>
              <a 
                href="#faq" 
                className="block text-white/80 hover:text-white transition-colors"
                onClick={() => setIsMenuOpen(false)}
              >
                FAQ
              </a>
              <Button 
                className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                onClick={() => setIsMenuOpen(false)}
              >
                Get Started
              </Button>
            </div>
          </div>
        )}
      </header>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900/40 via-gray-900 to-gray-950 z-0"></div>
        
        {/* Animated gradient orbs */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-600/30 rounded-full filter blur-3xl animate-pulse"></div>
        <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-pink-600/20 rounded-full filter blur-3xl animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/3 w-96 h-96 bg-cyan-600/20 rounded-full filter blur-3xl animate-pulse"></div>
        
        <div className="max-w-7xl mx-auto relative z-10">
          <div className="text-center max-w-4xl mx-auto mb-12">
            <Badge variant="outline" className="mb-6 text-purple-400 border-purple-400">
              🚀 Premium Marketing Agency
            </Badge>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-6">
              Transform Your Brand with <span className="bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-600">Data-Driven</span> Marketing
            </h1>
            <p className="text-xl text-gray-200 mb-8 max-w-3xl mx-auto">
              We combine creativity with analytics to deliver marketing strategies that drive measurable results and exceptional ROI for forward-thinking businesses.
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <Button size="lg" className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 shadow-lg shadow-purple-600/20">
                Get Free Consultation
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button size="lg" variant="outline" className="border-white/30 text-white hover:bg-white/20 hover:text-white">
                View Case Studies
              </Button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-16">
            <Card className="bg-white/5 backdrop-blur-lg border border-white/10 text-center">
              <CardContent className="pt-8 pb-8">
                <div className="text-4xl font-bold mb-2 bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-600">$2.4M+</div>
                <p className="text-gray-300">Revenue Generated for Clients</p>
              </CardContent>
            </Card>
            <Card className="bg-white/5 backdrop-blur-lg border border-white/10 text-center">
              <CardContent className="pt-8 pb-8">
                <div className="text-4xl font-bold mb-2 bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-600">150+</div>
                <p className="text-gray-300">Satisfied Clients</p>
              </CardContent>
            </Card>
            <Card className="bg-white/5 backdrop-blur-lg border border-white/10 text-center">
              <CardContent className="pt-8 pb-8">
                <div className="text-4xl font-bold mb-2 bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-600">300%</div>
                <p className="text-gray-300">Average ROI</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section id="services" className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">Our Premium Services</h2>
          <p className="text-xl text-gray-200 max-w-2xl mx-auto">
            Comprehensive marketing solutions designed to elevate your brand and drive measurable results.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Social Media Marketing */}
          <Card className="bg-white/5 backdrop-blur-lg border border-white/10 transition-all hover:bg-white/10 group">
            <CardHeader>
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-600 to-purple-800 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Zap size={28} className="text-white" />
              </div>
              <CardTitle className="text-2xl">Social Media Marketing</CardTitle>
              <CardDescription className="text-gray-300">
                Strategic content creation and community management that builds brand awareness and drives engagement across all platforms.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-gray-200">
                <li className="flex items-center">
                  <span className="w-2 h-2 bg-purple-500 rounded-full mr-3"></span>
                  Content Strategy & Creation
                </li>
                <li className="flex items-center">
                  <span className="w-2 h-2 bg-purple-500 rounded-full mr-3"></span>
                  Community Management
                </li>
                <li className="flex items-center">
                  <span className="w-2 h-2 bg-purple-500 rounded-full mr-3"></span>
                  Analytics & Reporting
                </li>
              </ul>
            </CardContent>
          </Card>

          {/* Paid Advertising */}
          <Card className="bg-white/5 backdrop-blur-lg border border-white/10 transition-all hover:bg-white/10 group">
            <CardHeader>
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-pink-600 to-pink-800 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <BarChart3 size={28} className="text-white" />
              </div>
              <CardTitle className="text-2xl">Paid Advertising</CardTitle>
              <CardDescription className="text-gray-300">
                Data-driven ad campaigns that target your ideal customers with precision, maximizing your return on ad spend.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-gray-200">
                <li className="flex items-center">
                  <span className="w-2 h-2 bg-pink-500 rounded-full mr-3"></span>
                  PPC & Social Media Ads
                </li>
                <li className="flex items-center">
                  <span className="w-2 h-2 bg-pink-500 rounded-full mr-3"></span>
                  Audience Targeting
                </li>
                <li className="flex items-center">
                  <span className="w-2 h-2 bg-pink-500 rounded-full mr-3"></span>
                  Performance Optimization
                </li>
              </ul>
            </CardContent>
          </Card>

          {/* Conversion Optimization */}
          <Card className="bg-white/5 backdrop-blur-lg border border-white/10 transition-all hover:bg-white/10 group">
            <CardHeader>
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-600 to-cyan-800 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <TrendingUp size={28} className="text-white" />
              </div>
              <CardTitle className="text-2xl">Conversion Optimization</CardTitle>
              <CardDescription className="text-gray-300">
                Data-driven strategies to maximize your website's conversion potential and turn visitors into customers.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-gray-200">
                <li className="flex items-center">
                  <span className="w-2 h-2 bg-cyan-500 rounded-full mr-3"></span>
                  Landing Page Optimization
                </li>
                <li className="flex items-center">
                  <span className="w-2 h-2 bg-cyan-500 rounded-full mr-3"></span>
                  A/B Testing
                </li>
                <li className="flex items-center">
                  <span className="w-2 h-2 bg-cyan-500 rounded-full mr-3"></span>
                  Performance Analytics
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Case Studies Section */}
      <section id="case-studies" className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">Success Stories</h2>
          <p className="text-xl text-gray-200">Real results from real clients</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <Card className="bg-white/5 backdrop-blur-lg border border-white/10">
            <CardHeader>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gradient-to-r from-blue-600 to-blue-800 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold">TC</span>
                </div>
                <div>
                  <CardTitle className="text-white">TechCorp Solutions</CardTitle>
                  <CardDescription className="text-gray-300">B2B Software Company</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <p className="text-gray-200">
                  Increased qualified leads by 180% and reduced cost per acquisition by 45% 
                  through targeted LinkedIn campaigns and conversion optimization.
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-4 bg-blue-500/10 rounded-lg border border-blue-500/20">
                    <div className="text-2xl font-bold text-blue-400">180%</div>
                    <div className="text-sm text-gray-400">Lead Increase</div>
                  </div>
                  <div className="text-center p-4 bg-green-500/10 rounded-lg border border-green-500/20">
                    <div className="text-2xl font-bold text-green-400">45%</div>
                    <div className="text-sm text-gray-400">Lower CAC</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/5 backdrop-blur-lg border border-white/10">
            <CardHeader>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gradient-to-r from-purple-600 to-purple-800 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold">RF</span>
                </div>
                <div>
                  <CardTitle className="text-white">RetailFashion Co.</CardTitle>
                  <CardDescription className="text-gray-300">E-commerce Fashion Brand</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <p className="text-gray-200">
                  Scaled monthly revenue from $50K to $200K in 6 months through strategic 
                  social media campaigns and influencer partnerships.
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-4 bg-purple-500/10 rounded-lg border border-purple-500/20">
                    <div className="text-2xl font-bold text-purple-400">300%</div>
                    <div className="text-sm text-gray-400">Revenue Growth</div>
                  </div>
                  <div className="text-center p-4 bg-orange-500/10 rounded-lg border border-orange-500/20">
                    <div className="text-2xl font-bold text-orange-400">6</div>
                    <div className="text-sm text-gray-400">Months</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Testimonials Section */}
      <section id="testimonials" className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">What Our Clients Say</h2>
          <p className="text-xl text-gray-200">Don't just take our word for it</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            {
              name: "Sarah Johnson",
              role: "CEO, TechStart Inc.",
              content: "SocialBloom transformed our marketing strategy. We saw a 250% increase in qualified leads within the first quarter.",
              rating: 5
            },
            {
              name: "Michael Chen",
              role: "Marketing Director, GrowthCo",
              content: "The team's expertise in paid advertising is unmatched. Our ROAS improved from 2x to 8x in just 4 months.",
              rating: 5
            },
            {
              name: "Emily Rodriguez",
              role: "Founder, EcoProducts",
              content: "Professional, data-driven, and results-focused. SocialBloom is the best marketing investment we've made.",
              rating: 5
            }
          ].map((testimonial, index) => (
            <Card key={index} className="bg-white/5 backdrop-blur-lg border border-white/10">
              <CardContent className="pt-6">
                <div className="space-y-4">
                  <div className="flex gap-1">
                    {[...Array(testimonial.rating)].map((_, i) => (
                      <Star key={i} className="h-4 w-4 text-yellow-400 fill-current" />
                    ))}
                  </div>
                  <p className="text-gray-200 italic">"{testimonial.content}"</p>
                  <div className="pt-4 border-t border-white/10">
                    <div className="font-semibold text-white">{testimonial.name}</div>
                    <div className="text-sm text-gray-400">{testimonial.role}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">Frequently Asked Questions</h2>
          <p className="text-xl text-gray-200">Everything you need to know about our services</p>
        </div>
        
        <div className="max-w-3xl mx-auto space-y-4">
          {[
            {
              question: "How long does it take to see results?",
              answer: "Most clients see initial improvements within 30-60 days, with significant growth typically occurring within the first quarter. Our data-driven approach ensures rapid optimization and measurable results."
            },
            {
              question: "What makes SocialBloom different from other agencies?",
              answer: "We focus on data-driven strategies with transparent reporting. Our team has deep expertise across all major platforms and we provide dedicated account management with premium support."
            },
            {
              question: "Do you work with businesses in my industry?",
              answer: "We work with businesses across various industries including B2B SaaS, e-commerce, healthcare, and professional services. Our strategies are customized to your specific market and goals."
            },
            {
              question: "What's included in your reporting?",
              answer: "Monthly reports include detailed analytics, campaign performance, ROI metrics, and strategic recommendations for continuous improvement. You'll have full transparency into your results."
            }
          ].map((faq, index) => (
            <div key={index} className="space-y-2">
              <button
                onClick={() => toggleFAQ(index)}
                className="w-full flex justify-between items-center p-6 bg-white/5 backdrop-blur-lg border border-white/10 rounded-lg hover:bg-white/10 transition-colors text-left"
              >
                <h3 className="text-lg font-semibold text-white">{faq.question}</h3>
                <ChevronDown
                  className={`transition-transform ${
                    openFAQ === index ? 'rotate-180' : ''
                  }`}
                  size={20}
                />
              </button>
              {openFAQ === index && (
                <div className="p-6 bg-white/5 backdrop-blur-lg border border-white/10 rounded-lg">
                  <p className="text-gray-200">{faq.answer}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900/30 via-gray-900 to-gray-950 z-0"></div>
        
        {/* Animated gradient orbs */}
        <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-purple-600/20 rounded-full filter blur-3xl animate-pulse"></div>
        <div className="absolute bottom-1/3 left-1/4 w-96 h-96 bg-pink-600/20 rounded-full filter blur-3xl animate-pulse"></div>
        
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-6">Ready to Transform Your Marketing?</h2>
          <p className="text-xl text-gray-200 mb-8 max-w-2xl mx-auto">
            Book a free 30-minute consultation with our team to discuss your goals and how we can help you achieve them.
          </p>
          
          <Card className="bg-white/5 backdrop-blur-lg border border-white/10 p-8 md:p-10 max-w-2xl mx-auto">
            <form className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-200 mb-2">
                    Full Name
                  </label>
                  <input
                    type="text"
                    id="name"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="John Doe"
                  />
                </div>
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-200 mb-2">
                    Email Address
                  </label>
                  <input
                    type="email"
                    id="email"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="john@example.com"
                  />
                </div>
              </div>
              <div>
                <label htmlFor="company" className="block text-sm font-medium text-gray-200 mb-2">
                  Company Name
                </label>
                <input
                  type="text"
                  id="company"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="Your Company"
                />
              </div>
              <div>
                <label htmlFor="message" className="block text-sm font-medium text-gray-200 mb-2">
                  How can we help?
                </label>
                <textarea
                  id="message"
                  rows={4}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="Tell us about your marketing goals..."
                ></textarea>
              </div>
              <Button
                type="submit"
                className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 py-4"
              >
                Book Your Free Consultation
              </Button>
            </form>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-950 border-t border-white/10 pt-16 pb-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-10 mb-16">
            <div className="col-span-1 md:col-span-1">
              <Link href="/socialbloom" className="flex items-center mb-6">
                <div className="h-10 w-10 rounded-full bg-gradient-to-r from-purple-600 to-pink-600 flex items-center justify-center mr-3">
                  <span className="text-white font-bold text-xl">S</span>
                </div>
                <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-500">
                  SocialBloom
                </span>
              </Link>
              <p className="text-gray-400 mb-6">
                Premium marketing solutions for brands that want to stand out and drive measurable results.
              </p>
            </div>
            
            <div>
              <h3 className="text-lg font-semibold mb-4">Services</h3>
              <ul className="space-y-3">
                <li><a href="#" className="text-gray-300 hover:text-white transition-colors">Social Media Marketing</a></li>
                <li><a href="#" className="text-gray-300 hover:text-white transition-colors">Paid Advertising</a></li>
                <li><a href="#" className="text-gray-300 hover:text-white transition-colors">Conversion Optimization</a></li>
                <li><a href="#" className="text-gray-300 hover:text-white transition-colors">Content Creation</a></li>
                <li><a href="#" className="text-gray-300 hover:text-white transition-colors">Analytics & Reporting</a></li>
              </ul>
            </div>
            
            <div>
              <h3 className="text-lg font-semibold mb-4">Company</h3>
              <ul className="space-y-3">
                <li><a href="#" className="text-gray-300 hover:text-white transition-colors">About Us</a></li>
                <li><a href="#case-studies" className="text-gray-300 hover:text-white transition-colors">Case Studies</a></li>
                <li><a href="#testimonials" className="text-gray-300 hover:text-white transition-colors">Testimonials</a></li>
                <li><a href="#" className="text-gray-300 hover:text-white transition-colors">Careers</a></li>
                <li><a href="#" className="text-gray-300 hover:text-white transition-colors">Contact</a></li>
              </ul>
            </div>
            
            <div>
              <h3 className="text-lg font-semibold mb-4">Contact</h3>
              <ul className="space-y-3">
                <li className="text-gray-300">123 Marketing St, Suite 100</li>
                <li className="text-white/60">San Francisco, CA 94103</li>
                <li className="text-white/60">hello@socialbloom.com</li>
                <li className="text-white/60">(555) 123-4567</li>
              </ul>
            </div>
          </div>
          
          <Separator className="my-8 bg-white/10" />
          
          <div className="flex flex-col md:flex-row justify-between items-center">
            <p className="text-white/60 text-sm mb-4 md:mb-0">
              © 2024 SocialBloom. All rights reserved.
            </p>
            <div className="flex space-x-6">
              <a href="#" className="text-white/60 text-sm hover:text-white transition-colors">
                Privacy Policy
              </a>
              <a href="#" className="text-white/60 text-sm hover:text-white transition-colors">
                Terms of Service
              </a>
              <a href="#" className="text-white/60 text-sm hover:text-white transition-colors">
                Cookie Policy
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}