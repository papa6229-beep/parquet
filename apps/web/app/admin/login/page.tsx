"use client"

import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"

export default function AdminLoginPage() {
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const router = useRouter()

  const handleLogin = async () => {
    const res = await fetch("/api/admin-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    })
    if (res.ok) {
      router.push("/admin")
    } else {
      setError("비밀번호가 올바르지 않습니다")
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
      <div className="w-80 space-y-4">
        <h1 className="text-zinc-100 text-lg font-semibold text-center">어드민 로그인</h1>
        <Input
          type="password"
          placeholder="비밀번호"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleLogin()}
          className="bg-zinc-900 border-zinc-700"
        />
        {error && <p className="text-red-400 text-sm">{error}</p>}
        <Button onClick={handleLogin} className="w-full bg-indigo-600 hover:bg-indigo-700">
          로그인
        </Button>
      </div>
    </div>
  )
}
