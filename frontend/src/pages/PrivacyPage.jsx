import { Link } from 'react-router-dom';

export default function PrivacyPage() {
  return (
    <div style={{fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",maxWidth:760,margin:'0 auto',padding:'40px 24px',color:'#111',lineHeight:1.7}}>
      <header style={{display:'flex',alignItems:'center',gap:12,marginBottom:40}}>
        <div style={{width:36,height:36,background:'#059669',borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center',color:'white',fontWeight:700,fontSize:'1rem'}}>E</div>
        <strong>Eight Submissions</strong>
      </header>
      <h1 style={{fontSize:'2rem',fontWeight:700,marginBottom:4}}>Privacy Policy</h1>
      <p style={{color:'#666',fontSize:'0.9rem',marginBottom:'2rem'}}>Last updated: 4 May 2026</p>
      <p>Eight Submissions ("we", "us", "our") is a Making Tax Digital platform that helps sole traders and businesses submit tax returns to HMRC. This policy explains how we collect, use and protect your personal data.</p>
      <h2 style={{fontSize:'1.2rem',fontWeight:600,marginTop:'2rem'}}>1. What data we collect</h2>
      <ul>
        <li>Your name and email address (for account registration)</li>
        <li>Business details including VAT registration number, Unique Taxpayer Reference, Company Registration Number, and National Insurance number</li>
        <li>Tax return data you enter and submit via our platform</li>
        <li>HMRC OAuth tokens used to connect your HMRC account to our service</li>
        <li>Device and browser information required by HMRC fraud prevention regulations</li>
      </ul>
      <h2 style={{fontSize:'1.2rem',fontWeight:600,marginTop:'2rem'}}>2. How we use your data</h2>
      <p>We use your data solely to provide the Eight Submissions service — specifically to authenticate you, connect to HMRC APIs on your behalf, and submit tax returns. We do not sell your data or use it for marketing purposes.</p>
      <h2 style={{fontSize:'1.2rem',fontWeight:600,marginTop:'2rem'}}>3. HMRC data sharing</h2>
      <p>To submit tax returns on your behalf, we share relevant data with HMRC via their Making Tax Digital APIs. This is the core purpose of the service. By using Eight Submissions you authorise us to interact with HMRC on your behalf using the credentials you provide.</p>
      <h2 style={{fontSize:'1.2rem',fontWeight:600,marginTop:'2rem'}}>4. Data storage</h2>
      <p>Your data is stored securely in a PostgreSQL database hosted by Supabase in the EU region. HMRC OAuth tokens are stored encrypted and are used only to make authorised API calls.</p>
      <h2 style={{fontSize:'1.2rem',fontWeight:600,marginTop:'2rem'}}>5. Data retention</h2>
      <p>We retain your account data for as long as you have an active account. Submission history is retained for 7 years in line with HMRC record-keeping requirements. You may request deletion of your account at any time by contacting us.</p>
      <h2 style={{fontSize:'1.2rem',fontWeight:600,marginTop:'2rem'}}>6. Your rights</h2>
      <p>Under UK GDPR you have the right to access, correct, or delete your personal data. To exercise these rights please contact us at <a href="mailto:enquiries@eightsubmissions.com" style={{color:'#059669'}}>enquiries@eightsubmissions.com</a>.</p>
      <h2 style={{fontSize:'1.2rem',fontWeight:600,marginTop:'2rem'}}>7. Cookies</h2>
      <p>Eight Submissions uses only essential session cookies required for authentication. We do not use tracking or advertising cookies.</p>
      <h2 style={{fontSize:'1.2rem',fontWeight:600,marginTop:'2rem'}}>8. Contact</h2>
      <p>For any privacy-related queries please email <a href="mailto:enquiries@eightsubmissions.com" style={{color:'#059669'}}>enquiries@eightsubmissions.com</a>.</p>
      <p style={{marginTop:'3rem',fontSize:'0.9rem'}}><Link to="/" style={{color:'#059669'}}>← Back to Eight Submissions</Link></p>
    </div>
  );
}
