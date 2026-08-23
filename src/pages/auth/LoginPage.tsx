import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

export default function LoginPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }
    navigate('/')
  }

  return (
    <div className="min-h-screen bg-ink flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-10">
          <span className="text-brand font-bold text-2xl tracking-tight">SPYKE</span>
          <span className="text-white font-light text-2xl tracking-tight ml-1">Coach</span>
        </div>

        <h1 className="text-white text-2xl font-semibold mb-2">Connexion</h1>
        <p className="text-muted text-sm mb-8">Accédez à votre espace coach</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-muted mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              placeholder="coach@example.com"
              className="w-full bg-sidebar-border border border-sidebar-border rounded-lg px-4 py-3 text-white placeholder-muted text-sm focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand transition-colors"
            />
          </div>
          <div>
            <label className="block text-sm text-muted mb-1.5">Mot de passe</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              className="w-full bg-sidebar-border border border-sidebar-border rounded-lg px-4 py-3 text-white placeholder-muted text-sm focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand transition-colors"
            />
          </div>

          {error && (
            <p className="text-accent text-sm bg-accent/10 border border-accent/20 rounded-lg px-4 py-3">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand hover:bg-brand-hover text-white font-medium py-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-2"
          >
            {loading ? 'Connexion…' : 'Se connecter'}
          </button>
        </form>

        <p className="text-center text-sm text-muted mt-6">
          Pas encore de compte ?{' '}
          <Link to="/signup" className="text-brand hover:text-white transition-colors">
            S'inscrire
          </Link>
        </p>
      </div>
    </div>
  )
}
