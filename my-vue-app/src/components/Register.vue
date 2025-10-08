<template>
  <div class="center-page">
    <div class="container">
      <h2 class="title">注册</h2>
      <input v-model="username" placeholder="用户名" :disabled="loading" @blur="checkUsername"/>
<div v-if="usernameMsg" class="msg" :class="usernameMsgType">{{ usernameMsg }}</div>
      <input
  v-model="password"
  type="password"
  placeholder="密码(8~20位，字母+数字)"
  :disabled="loading"
  @input="passwordMsg=validatePassword(password)"
  inputmode="latin"
  autocomplete="new-password"
/>
<div v-if="passwordMsg" class="msg error">{{ passwordMsg }}</div>
      <button @click="register" :disabled="loading || usernameTaken || !!passwordMsg">{{ loading ? '注册中...' : '注册' }}</button>
      <div v-if="msg" :class="['msg', msgType]">{{ msg }}</div>
      <div class="link-row">
        已有账号？<a @click="$router.push('/login')" class="link">去登录</a>
      </div>
    </div>
  </div>
</template>
<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
const usernameMsg = ref('')
const usernameMsgType = ref('')
const usernameTaken = ref(false)
const username = ref('')
const password = ref('')
const msg = ref('')
const msgType = ref('')
const loading = ref(false)
const router = useRouter()
const passwordMsg = ref("")

function validatePassword(pwd) {
  if (pwd.length < 8 || pwd.length > 20) return "密码长度需为8~20位"
  if (!/[a-zA-Z]/.test(pwd) || !/[0-9]/.test(pwd)) return "密码需包含英文字母和数字"
  return ""
}
async function register() {
  if (usernameTaken.value || passwordMsg.value) return
  msg.value = ''
  msgType.value = ''
  loading.value = true
  const res = await fetch('/api/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: username.value, password: password.value })
  })
  const text = await res.text()
  if (res.ok) {
    msg.value = '注册成功，请登录'
    msgType.value = 'success'
    setTimeout(() => {
      router.push('/login')
    }, 1200)
  } else {
    msg.value = text || '注册失败'
    msgType.value = 'error'
  }
  loading.value = false
}
async function checkUsername() {
  usernameMsg.value = ''
  usernameTaken.value = false
  if (!username.value) return
  const res = await fetch(`/api/check-username?username=${encodeURIComponent(username.value)}`)
  if (res.ok) {
    const data = await res.json()
    if (data.taken) {
      usernameMsg.value = '用户名已被占用'
      usernameMsgType.value = 'error'
      usernameTaken.value = true
    } else {
      usernameMsg.value = '用户名可用'
      usernameMsgType.value = 'success'
      usernameTaken.value = false
    }
  }
}
</script>
<style scoped>
.center-page {
  min-height: 100vh;
  min-width: 100vw;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(120deg,#e7ebf1,#f5f7fa);
}
.container {
  background: #fff;
  border-radius: 18px;
  box-shadow: 0 2px 16px #e1e5ef;
  padding: 38px 28px 32px 28px;
  width: 96vw;
  max-width: 350px;
  min-width: 270px;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.title {
  font-size: 1.4rem;
  font-weight:700;
  margin-bottom:25px;
  color:#223;
  letter-spacing:2px;
}
input {
  font-size: 1rem;
  border-radius: 8px;
  padding: 12px 15px;
  border: 1px solid #e2e2e2;
  outline: none;
  margin-bottom: 18px;
  width: 100%;
  box-sizing: border-box;
  background: #f5f8fa;
  transition: border 0.18s;
}
input:focus { border-color: #2466ff;}
button {
  padding: 12px 0;
  border-radius: 8px;
  border: none;
  background: #2466ff;
  color: #fff;
  font-size: 1.07rem;
  cursor: pointer;
  margin-bottom: 18px;
  width: 100%;
  font-weight: 500;
  transition: background 0.18s;
}
button:disabled { background: #b8c8f8; cursor: not-allowed;}
.msg {
  font-size: 0.98rem;
  margin-bottom: 8px;
  text-align: center;
  transition: color 0.18s;
}
.msg.error { color: #ff3b30;}
.msg.success { color: #129f15;}
.link-row {
  text-align: center;
  margin-top: 5px;
  font-size: 0.97rem;
}
.link {
  color: #2466ff;
  cursor: pointer;
  margin-left: 6px;
  text-decoration: underline;
}
@media (max-width: 480px) {
  .container {
    max-width: 99vw;
    min-width: 0;
    padding: 20px 6vw;
  }
}
</style>