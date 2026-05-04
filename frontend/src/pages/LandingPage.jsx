import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

const FAQS = [
  {
    q: 'Who is Eight Submissions for?',
    a: 'Eight Submissions is built for UK sole traders and small businesses who need to submit VAT returns through HMRC\'s Making Tax Digital (MTD) programme. If you\'re VAT registered and want a simple, no-fuss way to stay compliant, this is for you.',
  },
  {
    q: 'Do I need any accounting software?',
    a: 'No. Eight Submissions connects directly to HMRC on your behalf. You log in, connect your HMRC account, and submit your returns — no third-party accounting package required.',
  },
  {
    q: 'Is my data safe?',
    a: 'Yes. All data is stored encrypted in the EU. We use OAuth 2.0 to connect to HMRC, which means we never see or store your HMRC password. We comply fully with UK GDPR.',
  },
  {
    q: 'What tax types are supported?',
    a: 'VAT (MTD) is fully supported and live. Income Tax Self Assessment (ITSA) via MTD is in development and coming soon.',
  },
  {
    q: 'How much does it cost?',
    a: 'Eight Submissions is currently free while we\'re in early access. Paid plans will be introduced in future — early users will always get the best rate.',
  },
  {
    q: 'What if I have a problem or question?',
    a: 'Email us at enquiries@eightsubmissions.com and we\'ll get back to you as soon as possible.',
  },
];

const FEATURES = [
  {
    icon: '📋',
    title: 'Full VAT returns',
    desc: 'Submit complete 9-box VAT returns to HMRC directly. Nil and dormant returns supported too.',
  },
  {
    icon: '📜',
    title: 'Submission history',
    desc: 'Every submission is saved with HMRC\'s response. Review your full history any time.',
  },
  {
    icon: '🔗',
    title: 'Direct HMRC connection',
    desc: 'Connects securely to HMRC via OAuth 2.0. No middlemen, no CSV imports.',
  },
  {
    icon: '🔐',
    title: 'Two-factor authentication',
    desc: 'Protect your account with TOTP-based two-factor authentication for extra security.',
  },
  {
    icon: '🛡️',
    title: 'Fraud prevention compliant',
    desc: 'All required HMRC fraud prevention headers submitted with every API call.',
  },
  {
    icon: '🚀',
    title: 'ITSA coming soon',
    desc: 'Income Tax Self Assessment via MTD is in development. Early access users will be first.',
  },
];

export default function LandingPage() {
  const [openFaq, setOpenFaq] = useState(null);

  useEffect(() => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Lora:wght@400;500;600;700&family=DM+Sans:wght@300;400;500;600&display=swap';
    document.head.appendChild(link);
    return () => document.head.removeChild(link);
  }, []);

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif", background: '#FAFAF7', color: '#1a1a1a', lineHeight: 1.6 }}>

      {/* NAV */}
      <nav style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '20px 40px', background: '#FAFAF7',
        borderBottom: '1px solid #e8e4dc', position: 'sticky', top: 0, zIndex: 100,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 34, height: 34, background: '#065f46', borderRadius: 8,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'white', fontWeight: 700, fontSize: '1rem',
            fontFamily: "'Lora', serif",
          }}>8</div>
          <span style={{ fontWeight: 600, fontSize: '1rem', letterSpacing: '-0.02em' }}>Eight Submissions</span>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <Link to="/login" style={{
            color: '#065f46', fontWeight: 500, textDecoration: 'none', fontSize: '0.9rem',
          }}>Log in</Link>
          <Link to="/register" style={{
            background: '#065f46', color: 'white', padding: '9px 20px',
            borderRadius: 8, fontWeight: 500, textDecoration: 'none', fontSize: '0.9rem',
            transition: 'background 0.2s',
          }}>Get started free</Link>
        </div>
      </nav>

      {/* HERO */}
      <section style={{
        maxWidth: 820, margin: '0 auto', padding: '90px 24px 80px',
        textAlign: 'center',
      }}>
        <div style={{
          display: 'inline-block', background: '#dcfce7', color: '#065f46',
          padding: '6px 16px', borderRadius: 20, fontSize: '0.82rem',
          fontWeight: 600, marginBottom: 28, letterSpacing: '0.02em',
        }}>
          Making Tax Digital · VAT Returns · UK Sole Traders
        </div>
        <h1 style={{
          fontFamily: "'Lora', serif", fontSize: 'clamp(2.4rem, 5vw, 3.6rem)',
          fontWeight: 700, lineHeight: 1.2, marginBottom: 24,
          letterSpacing: '-0.02em', color: '#0f1a14',
        }}>
          Submit your VAT returns<br />without the headache
        </h1>
        <p style={{
          fontSize: '1.15rem', color: '#4a5568', maxWidth: 560, margin: '0 auto 40px',
          fontWeight: 400, lineHeight: 1.7,
        }}>
          Eight Submissions connects directly to HMRC so you can submit MTD VAT returns in minutes — no accounting software, no spreadsheets, no stress.
        </p>
        <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link to="/register" style={{
            background: '#065f46', color: 'white', padding: '14px 32px',
            borderRadius: 10, fontWeight: 600, textDecoration: 'none', fontSize: '1rem',
            boxShadow: '0 4px 14px rgba(6,95,70,0.3)',
          }}>Create free account</Link>
          <a href="#how-it-works" style={{
            background: 'white', color: '#065f46', padding: '14px 32px',
            borderRadius: 10, fontWeight: 600, textDecoration: 'none', fontSize: '1rem',
            border: '1.5px solid #d1fae5',
          }}>See how it works</a>
        </div>
        <p style={{ marginTop: 20, fontSize: '0.85rem', color: '#9ca3af' }}>
          Free during early access · No credit card required
        </p>
      </section>

      {/* HOW IT WORKS */}
      <section id="how-it-works" style={{ background: '#f0fdf4', padding: '80px 24px' }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <h2 style={{
            fontFamily: "'Lora', serif", fontSize: 'clamp(1.8rem, 3vw, 2.4rem)',
            fontWeight: 700, textAlign: 'center', marginBottom: 12, color: '#0f1a14',
          }}>Up and running in minutes</h2>
          <p style={{ textAlign: 'center', color: '#4a5568', marginBottom: 60, fontSize: '1.05rem' }}>
            Three steps and you're submitting returns to HMRC.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 32 }}>
            {[
              { n: '1', title: 'Connect your HMRC account', desc: 'Authorise Eight Submissions via HMRC\'s secure OAuth login. We never see your HMRC password.' },
              { n: '2', title: 'Add your business', desc: 'Enter your VAT registration number and business details. We\'ll verify them with HMRC automatically.' },
              { n: '3', title: 'Submit your return', desc: 'View your open VAT obligations, fill in your figures, and submit directly to HMRC. Done.' },
            ].map(step => (
              <div key={step.n} style={{
                background: 'white', borderRadius: 16, padding: '36px 28px',
                boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
              }}>
                <div style={{
                  width: 44, height: 44, background: '#065f46', borderRadius: 12,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'white', fontWeight: 700, fontSize: '1.1rem',
                  fontFamily: "'Lora', serif", marginBottom: 20,
                }}>{step.n}</div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: 10, color: '#0f1a14' }}>{step.title}</h3>
                <p style={{ color: '#4a5568', fontSize: '0.95rem', lineHeight: 1.6 }}>{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section style={{ padding: '80px 24px', background: '#FAFAF7' }}>
        <div style={{ maxWidth: 960, margin: '0 auto' }}>
          <h2 style={{
            fontFamily: "'Lora', serif", fontSize: 'clamp(1.8rem, 3vw, 2.4rem)',
            fontWeight: 700, textAlign: 'center', marginBottom: 12, color: '#0f1a14',
          }}>Everything you need, nothing you don't</h2>
          <p style={{ textAlign: 'center', color: '#4a5568', marginBottom: 56, fontSize: '1.05rem' }}>
            Built specifically for MTD compliance — no bloat, no upsells.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 24 }}>
            {FEATURES.map(f => (
              <div key={f.title} style={{
                background: 'white', borderRadius: 14, padding: '28px 24px',
                border: '1px solid #e8e4dc',
              }}>
                <div style={{ fontSize: '1.8rem', marginBottom: 14 }}>{f.icon}</div>
                <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 8, color: '#0f1a14' }}>{f.title}</h3>
                <p style={{ color: '#4a5568', fontSize: '0.9rem', lineHeight: 1.6 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section style={{ background: '#f0fdf4', padding: '80px 24px' }}>
        <div style={{ maxWidth: 680, margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{
            fontFamily: "'Lora', serif", fontSize: 'clamp(1.8rem, 3vw, 2.4rem)',
            fontWeight: 700, marginBottom: 12, color: '#0f1a14',
          }}>Simple, honest pricing</h2>
          <p style={{ color: '#4a5568', marginBottom: 48, fontSize: '1.05rem' }}>
            Free while we're in early access. Early users lock in the best rate when paid plans launch.
          </p>
          <div style={{
            background: 'white', borderRadius: 20, padding: '48px 40px',
            boxShadow: '0 4px 24px rgba(0,0,0,0.08)', border: '2px solid #d1fae5',
          }}>
            <div style={{
              display: 'inline-block', background: '#dcfce7', color: '#065f46',
              padding: '4px 14px', borderRadius: 20, fontSize: '0.8rem',
              fontWeight: 600, marginBottom: 20,
            }}>Early access</div>
            <div style={{
              fontFamily: "'Lora', serif", fontSize: '3.5rem', fontWeight: 700,
              color: '#0f1a14', lineHeight: 1, marginBottom: 6,
            }}>£0</div>
            <p style={{ color: '#4a5568', marginBottom: 32, fontSize: '0.95rem' }}>per month · all features included</p>
            <ul style={{ listStyle: 'none', padding: 0, marginBottom: 36, textAlign: 'left' }}>
              {['Unlimited VAT return submissions','Full submission history','Two-factor authentication','Direct HMRC connection via OAuth','ITSA support when it launches','Email support'].map(item => (
                <li key={item} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 0', borderBottom: '1px solid #f0fdf4',
                  fontSize: '0.95rem', color: '#374151',
                }}>
                  <span style={{ color: '#059669', fontWeight: 700, fontSize: '1rem' }}>✓</span>
                  {item}
                </li>
              ))}
            </ul>
            <Link to="/register" style={{
              display: 'block', background: '#065f46', color: 'white',
              padding: '14px', borderRadius: 10, fontWeight: 600,
              textDecoration: 'none', fontSize: '1rem',
              boxShadow: '0 4px 14px rgba(6,95,70,0.3)',
            }}>Get started free</Link>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section style={{ padding: '80px 24px', background: '#FAFAF7' }}>
        <div style={{ maxWidth: 680, margin: '0 auto' }}>
          <h2 style={{
            fontFamily: "'Lora', serif", fontSize: 'clamp(1.8rem, 3vw, 2.4rem)',
            fontWeight: 700, textAlign: 'center', marginBottom: 48, color: '#0f1a14',
          }}>Common questions</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {FAQS.map((faq, i) => (
              <div key={i} style={{
                background: 'white', borderRadius: 12, border: '1px solid #e8e4dc',
                overflow: 'hidden',
              }}>
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  style={{
                    width: '100%', padding: '20px 24px', textAlign: 'left',
                    background: 'none', border: 'none', cursor: 'pointer',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    fontFamily: "'DM Sans', sans-serif", fontSize: '0.98rem',
                    fontWeight: 600, color: '#0f1a14',
                  }}>
                  {faq.q}
                  <span style={{
                    fontSize: '1.2rem', color: '#065f46',
                    transform: openFaq === i ? 'rotate(45deg)' : 'none',
                    transition: 'transform 0.2s', flexShrink: 0, marginLeft: 16,
                  }}>+</span>
                </button>
                {openFaq === i && (
                  <div style={{
                    padding: '0 24px 20px', color: '#4a5568',
                    fontSize: '0.93rem', lineHeight: 1.7,
                    borderTop: '1px solid #f0fdf4',
                  }}>
                    <p style={{ margin: '16px 0 0' }}>{faq.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
          <p style={{ textAlign: 'center', marginTop: 40, color: '#4a5568', fontSize: '0.95rem' }}>
            Still have questions?{' '}
            <a href="mailto:enquiries@eightsubmissions.com" style={{ color: '#065f46', fontWeight: 600 }}>
              Email us
            </a>
          </p>
        </div>
      </section>

      {/* CTA BANNER */}
      <section style={{ background: '#065f46', padding: '70px 24px', textAlign: 'center' }}>
        <h2 style={{
          fontFamily: "'Lora', serif", fontSize: 'clamp(1.8rem, 3vw, 2.6rem)',
          fontWeight: 700, color: 'white', marginBottom: 16,
        }}>Ready to simplify your tax returns?</h2>
        <p style={{ color: '#a7f3d0', marginBottom: 36, fontSize: '1.05rem' }}>
          Free to use · Takes 5 minutes to set up · No accounting software needed
        </p>
        <Link to="/register" style={{
          background: 'white', color: '#065f46', padding: '14px 36px',
          borderRadius: 10, fontWeight: 700, textDecoration: 'none', fontSize: '1rem',
        }}>Create your free account</Link>
      </section>

      {/* FOOTER */}
      <footer style={{
        background: '#0f1a14', color: '#9ca3af', padding: '40px 24px',
        textAlign: 'center', fontSize: '0.88rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 20 }}>
          <div style={{
            width: 28, height: 28, background: '#065f46', borderRadius: 6,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'white', fontWeight: 700, fontSize: '0.85rem',
            fontFamily: "'Lora', serif",
          }}>8</div>
          <span style={{ color: 'white', fontWeight: 600 }}>Eight Submissions</span>
        </div>
        <div style={{ display: 'flex', gap: 24, justifyContent: 'center', marginBottom: 20, flexWrap: 'wrap' }}>
          <Link to="/privacy" style={{ color: '#9ca3af', textDecoration: 'none' }}>Privacy Policy</Link>
          <Link to="/terms" style={{ color: '#9ca3af', textDecoration: 'none' }}>Terms and Conditions</Link>
          <a href="mailto:enquiries@eightsubmissions.com" style={{ color: '#9ca3af', textDecoration: 'none' }}>Contact</a>
        </div>
        <p style={{ margin: 0 }}>© {new Date().getFullYear()} Eight Submissions · Making Tax Digital platform for UK businesses</p>
      </footer>
    </div>
  );
}
