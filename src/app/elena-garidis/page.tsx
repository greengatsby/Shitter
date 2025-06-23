import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Mail, MapPin, Building2, Phone } from "lucide-react"

export default function ElenaGaridisContact() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-white">
      {/* Header */}
      <header className="bg-[#8c1515] text-white py-8">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold mb-2">Stanford Graduate School of Business</h1>
              <p className="text-red-100">Contact Directory</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto space-y-8">
          
          {/* Profile Header */}
          <div className="text-center space-y-6">
            <div className="flex justify-center">
              <img 
                src="https://www.gsb.stanford.edu/sites/default/files/styles/270_x_270/public/staff/photo/EG_print-8.jpg.webp?itok=mr8UU_za"
                alt="Elena Garidis"
                className="w-48 h-48 rounded-full object-cover border-4 border-[#8c1515] shadow-lg"
              />
            </div>
            <div className="space-y-4">
              <h1 className="text-5xl font-bold text-gray-900">Elena Garidis</h1>
              <p className="text-xl text-[#8c1515] font-semibold">
                Associate Director, Ecopreneurship Partner Programs
              </p>
              <p className="text-lg text-gray-600">
                Stanford Graduate School of Business • Sustainability Accelerator
              </p>
            </div>
          </div>

          <Separator />

          {/* Contact Information Grid */}
          <div className="grid md:grid-cols-2 gap-8">
            
            {/* Contact Details Card */}
            <Card className="border-l-4 border-l-[#8c1515]">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="h-5 w-5 text-[#8c1515]" />
                  Contact Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <Mail className="h-4 w-4 text-gray-500" />
                  <a 
                    href="mailto:egaridis@stanford.edu"
                    className="text-[#8c1515] hover:underline font-medium"
                  >
                    egaridis@stanford.edu
                  </a>
                </div>
                <div className="flex items-center gap-3">
                  <Building2 className="h-4 w-4 text-gray-500" />
                  <span className="text-gray-700">Mail Code: 2210</span>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="text-[#8c1515] border-[#8c1515]">
                    Sustainability Accelerator
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* Office Information Card */}
            <Card className="border-l-4 border-l-[#8c1515]">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-[#8c1515]" />
                  Office Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <p className="font-medium text-gray-900">Stanford Graduate School of Business</p>
                  <p className="text-gray-700">655 Knight Way</p>
                  <p className="text-gray-700">Stanford, CA 94305</p>
                </div>
                <div className="flex items-center gap-3">
                  <Phone className="h-4 w-4 text-gray-500" />
                  <span className="text-gray-700">Stanford University</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Professional Role Section */}
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl text-gray-900">Professional Role</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-700 leading-relaxed text-lg">
                Elena Garidis serves as the Associate Director of Ecopreneurship Partner Programs 
                within the Sustainability Accelerator at Stanford Graduate School of Business. In this role, 
                she focuses on externally facing programs, events, and initiatives designed to support 
                and develop the ecopreneurship ecosystem.
              </p>
            </CardContent>
          </Card>

          {/* Areas of Focus */}
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl text-gray-900">Areas of Focus</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-4">
                {[
                  "Ecopreneurship initiatives",
                  "Partner program development", 
                  "Sustainability-focused business acceleration",
                  "External stakeholder engagement",
                  "Ecosystem development for sustainable ventures"
                ].map((area, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-[#8c1515] rounded-full" />
                    <span className="text-gray-700">{area}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* General Contact Footer */}
          <Card className="bg-gray-50">
            <CardContent className="pt-6">
              <p className="text-center text-gray-600">
                For general inquiries about Stanford Graduate School of Business, please visit{" "}
                <a 
                  href="https://www.gsb.stanford.edu" 
                  className="text-[#8c1515] hover:underline font-medium"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  www.gsb.stanford.edu
                </a>
                {" "}or call{" "}
                <a 
                  href="tel:650-723-2300" 
                  className="text-[#8c1515] hover:underline font-medium"
                >
                  (650) 723-2300
                </a>
                .
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}