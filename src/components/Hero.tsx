import Link from 'next/link'

export default function Hero() {
  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Gradient Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-purple-600 via-violet-500 to-pink-500 z-0"></div>
      
      {/* Decorative Elements */}
      <div className="absolute top-20 left-10 w-72 h-72 bg-white/10 rounded-full blur-3xl"></div>
      <div className="absolute bottom-20 right-10 w-80 h-80 bg-white/10 rounded-full blur-3xl"></div>
      
      <div className="container mx-auto px-6 relative z-10">
        <div className="flex flex-col md:flex-row items-center justify-between gap-12">
          <div className="w-full md:w-3/5 text-center md:text-left">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-white leading-tight mb-6">
              Transform Your Brand's <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-200 to-yellow-400">Digital Presence</span>
            </h1>
            
            <p className="text-xl md:text-2xl text-white/80 mb-8 max-w-2xl mx-auto md:mx-0">
              We craft strategic marketing solutions that drive growth, engagement, and measurable results for forward-thinking businesses.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center md:justify-start">
              <Link 
                href="/contact" 
                className="px-8 py-4 bg-white text-purple-700 rounded-full font-bold text-lg transition-all hover:bg-yellow-300 hover:text-purple-800 hover:shadow-lg"
              >
                Get Started
              </Link>
              
              <Link 
                href="/portfolio" 
                className="px-8 py-4 bg-transparent border-2 border-white text-white rounded-full font-bold text-lg transition-all hover:bg-white/10"
              >
                View Our Work
              </Link>
            </div>
          </div>
          
          <div className="w-full md:w-2/5">
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20 shadow-xl">
              <h3 className="text-2xl font-bold text-white mb-4">Ready to elevate your brand?</h3>
              <p className="text-white/80 mb-6">Schedule a free strategy session with our experts today.</p>
              
              <form className="space-y-4">
                <input 
                  type="email" 
                  placeholder="Your email" 
                  className="w-full px-4 py-3 bg-white/20 rounded-lg text-white placeholder-white/60 border border-white/10 focus:outline-none focus:ring-2 focus:ring-white/50"
                />
                <button 
                  type="submit" 
                  className="w-full px-4 py-3 bg-gradient-to-r from-yellow-400 to-yellow-300 text-purple-800 rounded-lg font-bold hover:opacity-90 transition-opacity"
                >
                  Book Free Consultation
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}