import { Link } from 'react-router-dom';

export default function TermsPage() {
  return (
    <div style={{fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",maxWidth:760,margin:'0 auto',padding:'40px 24px',color:'#111',lineHeight:1.7}}>
      <header style={{display:'flex',alignItems:'center',gap:12,marginBottom:40}}>
        <div style={{width:36,height:36,background:'#059669',borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center',color:'white',fontWeight:700,fontSize:'1rem'}}>E</div>
        <strong>Eight Submissions</strong>
      </header>
      <h1 style={{fontSize:'2rem',fontWeight:700,marginBottom:4}}>Terms and Conditions</h1>
      <p style={{color:'#666',fontSize:'0.9rem',marginBottom:'2rem'}}>Last updated: 4 May 2026</p>
      <p>These terms govern your use of Eight Submissions ("the service"), a Making Tax Digital platform operated by Eight Submissions. By creating an account you agree to these terms.</p>
      <h2 style={{fontSize:'1.2rem',fontWeight:600,marginTop:'2rem'}}>1. The service</h2>
      <p>Eight Submissions provides a platform for sole traders and businesses to submit tax returns to HMRC via the Making Tax Digital APIs. The service acts as an intermediary between you and HMRC — you remain responsible for the accuracy of all information submitted.</p>
      <h2 style={{fontSize:'1.2rem',fontWeight:600,marginTop:'2rem'}}>2. Your responsibilities</h2>
      <ul>
        <li>You are responsible for the accuracy of all tax data you enter and submit</li>
        <li>You must keep your login credentials secure and not share them with others</li>
        <li>You must notify us immediately if you suspect unauthorised access to your account</li>
        <li>You must use the service in accordance with all applicable UK tax laws and HMRC requirements</li>
      </ul>
      <h2 style={{fontSize:'1.2rem',fontWeight:600,marginTop:'2rem'}}>3. HMRC authorisation</h2>
      <p>By connecting your HMRC account to Eight Submissions, you authorise us to interact with HMRC APIs on your behalf. You can revoke this authorisation at any time through your HMRC online account or by disconnecting within the Eight Submissions platform.</p>
      <h2 style={{fontSize:'1.2rem',fontWeight:600,marginTop:'2rem'}}>4. Accuracy of submissions</h2>
      <p>While we aim to provide a reliable platform, you are solely responsible for the accuracy and completeness of any tax return submitted through our service. Eight Submissions does not provide tax advice. If you are unsure about your tax obligations, please consult a qualified accountant or tax adviser.</p>
      <h2 style={{fontSize:'1.2rem',fontWeight:600,marginTop:'2rem'}}>5. Availability</h2>
      <p>We aim to keep Eight Submissions available at all times but cannot guarantee uninterrupted service. We are not liable for any losses arising from service downtime or unavailability of HMRC APIs.</p>
      <h2 style={{fontSize:'1.2rem',fontWeight:600,marginTop:'2rem'}}>6. Limitation of liability</h2>
      <p>To the maximum extent permitted by law, Eight Submissions shall not be liable for any indirect, incidental, or consequential loss arising from your use of the service, including any penalties or interest charged by HMRC.</p>
      <h2 style={{fontSize:'1.2rem',fontWeight:600,marginTop:'2rem'}}>7. Termination</h2>
      <p>You may close your account at any time by contacting us. We reserve the right to suspend or terminate accounts that breach these terms.</p>
      <h2 style={{fontSize:'1.2rem',fontWeight:600,marginTop:'2rem'}}>8. Changes to these terms</h2>
      <p>We may update these terms from time to time. We will notify you of significant changes by email. Continued use of the service after changes constitutes acceptance of the updated terms.</p>
      <h2 style={{fontSize:'1.2rem',fontWeight:600,marginTop:'2rem'}}>9. Governing law</h2>
      <p>These terms are governed by the laws of England and Wales.</p>
      <h2 style={{fontSize:'1.2rem',fontWeight:600,marginTop:'2rem'}}>10. Contact</h2>
      <p>For any queries regarding these terms please email <a href="mailto:george@eightsubmissions.com" style={{color:'#059669'}}>george@eightsubmissions.com</a>.</p>
      <p style={{marginTop:'3rem',fontSize:'0.9rem'}}><Link to="/" style={{color:'#059669'}}>← Back to Eight Submissions</Link></p>
    </div>
  );
}
