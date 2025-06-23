import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { 
  Users, 
  TrendingUp, 
  Target, 
  Award,
  CheckCircle,
  BarChart3,
  Globe,
  ArrowRight,
  Phone,
  Mail,
  MapPin,
  Star
} from "lucide-react"

export default function ExpertsHelpingBusinessesPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b bg-white sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-r from-blue-900 to-blue-800 rounded-lg flex items-center justify-center">
                <BarChart3 className="h-6 w-6 text-yellow-400" />
              </div>
              <span className="text-2xl font-bold text-blue-900">Experts Helping Businesses</span>
            </div>
            <nav className="hidden md:flex items-center space-x-8">
              <a href="#about" className="text-gray-600 hover:text-blue-900">About</a>
              <a href="#services" className="text-gray-600 hover:text-blue-900">Services</a>
              <a href="#outsourcing" className="text-gray-600 hover:text-blue-900">Outsourcing</a>
              <a href="#contact" className="text-gray-600 hover:text-blue-900">Contact</a>
            </nav>
            <Button className="bg-yellow-500 hover:bg-yellow-600 text-blue-900 font-bold">
              Get Started
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20 bg-gradient-to-br from-blue-50 to-yellow-50">
        <div className="container mx-auto px-4 text-center">
          <div className="max-w-4xl mx-auto space-y-8">
            <Badge variant="outline" className="text-blue-900 border-blue-200">
              🚀 Business Growth Experts
            </Badge>
            <h1 className="text-5xl md:text-6xl font-bold text-blue-900">
              Experts Helping
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-600 to-yellow-500">
                {" "}Businesses
              </span>
              {" "}Succeed
            </h1>
            <p className="text-xl text-gray-700 max-w-2xl mx-auto">
              We provide strategic business consulting, operational excellence, and outsourcing solutions 
              to help your company achieve sustainable growth and competitive advantage.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" className="bg-blue-900 hover:bg-blue-800">
                Schedule Consultation
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button size="lg" variant="outline" className="border-blue-900 text-blue-900 hover:bg-blue-50">
                View Our Services
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 bg-blue-900">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 text-center">
            <div>
              <div className="text-4xl font-bold text-yellow-400 mb-2">500+</div>
              <div className="text-blue-100">Businesses Helped</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-yellow-400 mb-2">15+</div>
              <div className="text-blue-100">Years Experience</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-yellow-400 mb-2">98%</div>
              <div className="text-blue-100">Client Satisfaction</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-yellow-400 mb-2">25+</div>
              <div className="text-blue-100">Expert Consultants</div>
            </div>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-blue-900 mb-4">About Experts Helping Businesses</h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              With over 15 years of experience, we are a leading business consulting firm specializing in 
              helping companies optimize their operations, scale efficiently, and achieve sustainable growth.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <Card className="border-2 hover:border-yellow-200 transition-colors">
              <CardHeader>
                <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center mb-4">
                  <Target className="h-6 w-6 text-yellow-600" />
                </div>
                <CardTitle className="text-blue-900">Strategic Planning</CardTitle>
                <CardDescription>
                  Comprehensive business strategy development and implementation for long-term success
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border-2 hover:border-yellow-200 transition-colors">
              <CardHeader>
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                  <TrendingUp className="h-6 w-6 text-blue-600" />
                </div>
                <CardTitle className="text-blue-900">Growth Optimization</CardTitle>
                <CardDescription>
                  Data-driven approaches to accelerate business growth and market expansion
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border-2 hover:border-yellow-200 transition-colors">
              <CardHeader>
                <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center mb-4">
                  <Award className="h-6 w-6 text-yellow-600" />
                </div>
                <CardTitle className="text-blue-900">Excellence & Quality</CardTitle>
                <CardDescription>
                  Proven methodologies and best practices to ensure operational excellence
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section id="services" className="py-20 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-blue-900 mb-4">Our Services</h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Comprehensive business solutions tailored to your specific needs and industry requirements
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              {
                title: "Business Strategy Consulting",
                description: "Strategic planning, market analysis, and competitive positioning",
                icon: Target
              },
              {
                title: "Operational Excellence",
                description: "Process optimization, efficiency improvements, and quality management",
                icon: TrendingUp
              },
              {
                title: "Financial Advisory",
                description: "Financial planning, cost optimization, and investment strategies",
                icon: BarChart3
              },
              {
                title: "Digital Transformation",
                description: "Technology integration, digital strategy, and automation solutions",
                icon: Globe
              },
              {
                title: "Human Resources",
                description: "Talent acquisition, organizational development, and performance management",
                icon: Users
              },
              {
                title: "Change Management",
                description: "Organizational change, culture transformation, and leadership development",
                icon: Award
              }
            ].map((service, index) => (
              <Card key={index} className="bg-white hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                    <service.icon className="h-6 w-6 text-blue-600" />
                  </div>
                  <CardTitle className="text-blue-900">{service.title}</CardTitle>
                  <CardDescription>{service.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button variant="outline" className="w-full border-blue-900 text-blue-900 hover:bg-blue-50">
                    Learn More
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Outsourcing Benefits Section */}
      <section id="outsourcing" className="py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-blue-900 mb-4">Why Choose Our Outsourcing Solutions?</h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Our outsourcing services help businesses reduce costs, improve efficiency, and focus on core competencies
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <h3 className="text-2xl font-bold text-blue-900">Key Benefits</h3>
              <div className="space-y-4">
                {[
                  "Cost reduction up to 40%",
                  "Access to specialized expertise",
                  "Improved operational efficiency",
                  "24/7 service availability",
                  "Scalable resources",
                  "Focus on core business activities"
                ].map((benefit, index) => (
                  <div key={index} className="flex items-center space-x-3">
                    <CheckCircle className="h-5 w-5 text-yellow-600" />
                    <span className="text-gray-700">{benefit}</span>
                  </div>
                ))}
              </div>
            </div>
            
            <Card className="bg-gradient-to-br from-blue-50 to-yellow-50 border-yellow-200">
              <CardHeader>
                <CardTitle className="text-blue-900">Ready to Get Started?</CardTitle>
                <CardDescription>
                  Schedule a free consultation to discuss your outsourcing needs and custom solutions
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button className="w-full bg-blue-900 hover:bg-blue-800">
                  Schedule Free Consultation
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="py-20 bg-blue-900">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-white mb-4">Contact Us</h2>
            <p className="text-xl text-blue-100 max-w-2xl mx-auto">
              Ready to transform your business? Get in touch with our expert consultants today
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
            <Card className="bg-white/10 backdrop-blur border-white/20">
              <CardContent className="pt-8">
                <Phone className="h-8 w-8 text-yellow-400 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-white mb-2">Phone</h3>
                <p className="text-blue-100">+1 (555) 123-4567</p>
              </CardContent>
            </Card>
            
            <Card className="bg-white/10 backdrop-blur border-white/20">
              <CardContent className="pt-8">
                <Mail className="h-8 w-8 text-yellow-400 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-white mb-2">Email</h3>
                <p className="text-blue-100">info@expertshelpingbusinesses.com</p>
              </CardContent>
            </Card>
            
            <Card className="bg-white/10 backdrop-blur border-white/20">
              <CardContent className="pt-8">
                <MapPin className="h-8 w-8 text-yellow-400 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-white mb-2">Office</h3>
                <p className="text-blue-100">123 Business Ave, Suite 100<br />New York, NY 10001</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="space-y-4">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg flex items-center justify-center">
                  <BarChart3 className="h-5 w-5 text-yellow-400" />
                </div>
                <span className="text-xl font-bold">Experts Helping Businesses</span>
              </div>
              <p className="text-gray-400">
                Empowering businesses to achieve sustainable growth through expert consulting and innovative solutions.
              </p>
            </div>
            
            <div>
              <h3 className="font-semibold mb-4">Services</h3>
              <ul className="space-y-2 text-gray-400">
                <li>Business Strategy</li>
                <li>Operational Excellence</li>
                <li>Financial Advisory</li>
                <li>Digital Transformation</li>
              </ul>
            </div>
            
            <div>
              <h3 className="font-semibold mb-4">Company</h3>
              <ul className="space-y-2 text-gray-400">
                <li>About Us</li>
                <li>Our Team</li>
                <li>Case Studies</li>
                <li>Careers</li>
              </ul>
            </div>
            
            <div>
              <h3 className="font-semibold mb-4">Contact</h3>
              <ul className="space-y-2 text-gray-400">
                <li>+1 (555) 123-4567</li>
                <li>info@expertshelpingbusinesses.com</li>
                <li>New York, NY</li>
              </ul>
            </div>
          </div>
          
          <Separator className="my-8 bg-gray-700" />
          
          <div className="flex flex-col md:flex-row justify-between items-center">
            <p className="text-gray-400">&copy; 2024 Experts Helping Businesses. All rights reserved.</p>
            <div className="flex space-x-6 text-gray-400">
              <a href="#" className="hover:text-white">Privacy Policy</a>
              <a href="#" className="hover:text-white">Terms of Service</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}