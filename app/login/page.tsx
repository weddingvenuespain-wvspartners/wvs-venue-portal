import { redirect } from 'next/navigation'

// Login is now served at the root URL (/)
export default function LoginRedirect() {
  redirect('/')
}
