<script setup lang="ts">
</script>

<template>
  <div class="app-shell">
    <nav class="top-nav">
      <router-link to="/map" class="nav-link">地图</router-link>
      <router-link to="/teach" class="nav-link">教师端</router-link>
      <router-link to="/learn" class="nav-link">学生端</router-link>
    </nav>
    <main class="main-content">
      <router-view />
    </main>
  </div>
</template>

<style scoped>
.app-shell {
  display: flex;
  flex-direction: column;
  height: 100vh;
}
.top-nav {
  display: flex;
  gap: 1rem;
  padding: 0.5rem 1rem;
  background: #1a1a2e;
  border-bottom: 1px solid #333;
}
.nav-link {
  color: #ccc;
  text-decoration: none;
  padding: 0.25rem 0.75rem;
  border-radius: 4px;
  font-size: 14px;
}
.nav-link.router-link-active {
  color: #fff;
  background: #333;
}
.main-content {
  flex: 1;
  overflow: hidden;
}

@media (max-width: 560px) {
  .top-nav {
    padding: 0.4rem 0.6rem;
    gap: 0.5rem;
  }
  .nav-link {
    padding: 0.25rem 0.5rem;
    font-size: 13px;
  }
}
</style>