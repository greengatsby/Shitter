import { NextRequest, NextResponse } from 'next/server'

// GET /api/github/callback - Handle GitHub OAuth callback
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')
  const errorDescription = searchParams.get('error_description')

  // Create HTML response that will communicate with the parent window
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>GitHub OAuth Callback</title>
      </head>
      <body>
        <div style="
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100vh;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background: #f8f9fa;
        ">
          <div style="
            background: white;
            padding: 2rem;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            text-align: center;
            max-width: 400px;
          ">
            ${error ? `
              <h2 style="color: #dc3545;">OAuth Failed</h2>
              <p style="color: #6c757d;">${errorDescription || error}</p>
            ` : `
              <h2 style="color: #28a745;">GitHub Connected!</h2>
              <p style="color: #6c757d;">Processing your GitHub connection...</p>
              <div style="
                width: 40px;
                height: 40px;
                border: 3px solid #f3f3f3;
                border-top: 3px solid #007bff;
                border-radius: 50%;
                animation: spin 1s linear infinite;
                margin: 1rem auto;
              "></div>
            `}
          </div>
        </div>
        
        <style>
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        </style>
        
        <script>
          (function() {
            const urlParams = new URLSearchParams(window.location.search);
            const code = urlParams.get('code');
            const state = urlParams.get('state');
            const error = urlParams.get('error');
            const errorDescription = urlParams.get('error_description');
            
            if (window.opener) {
              if (error) {
                window.opener.postMessage({
                  type: 'GITHUB_OAUTH_ERROR',
                  error: errorDescription || error
                }, '*');
              } else if (code && state) {
                window.opener.postMessage({
                  type: 'GITHUB_OAUTH_SUCCESS',
                  code: code,
                  state: state
                }, '*');
              } else {
                window.opener.postMessage({
                  type: 'GITHUB_OAUTH_ERROR',
                  error: 'Missing required parameters'
                }, '*');
              }
              
              // Close the popup after a short delay
              setTimeout(() => {
                window.close();
              }, 1000);
            } else {
              // Fallback if opener is not available
              console.error('No opener window found');
              setTimeout(() => {
                window.close();
              }, 3000);
            }
          })();
        </script>
      </body>
    </html>
  `

  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html',
    },
  })
} 