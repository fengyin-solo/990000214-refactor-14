<template>
  <div class="dashboard">
    <h2 class="page-title">管理面板</h2>
    
    <el-row :gutter="20" class="stat-cards">
      <el-col :span="8">
        <el-card shadow="hover">
          <div class="stat-item">
            <div class="stat-number">{{ stats.totalArticles }}</div>
            <div class="stat-label">文章总数</div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="8">
        <el-card shadow="hover">
          <div class="stat-item">
            <div class="stat-number">{{ stats.totalTags }}</div>
            <div class="stat-label">标签数量</div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="8">
        <el-card shadow="hover">
          <div class="stat-item">
            <div class="stat-number">{{ stats.recentArticles }}</div>
            <div class="stat-label">本周新文章</div>
          </div>
        </el-card>
      </el-col>
    </el-row>
    
    <el-row :gutter="20" class="quick-actions">
      <el-col :span="24">
        <el-card>
          <template #header>
            <span>快捷操作</span>
          </template>
          <el-space>
            <el-button type="primary" @click="goToCreateArticle">
              写新文章
            </el-button>
            <el-button @click="goToArticleList">
              管理文章
            </el-button>
            <el-button @click="goToHome">
              查看博客
            </el-button>
          </el-space>
        </el-card>
      </el-col>
    </el-row>
    
    <el-row :gutter="20" class="recent-articles">
      <el-col :span="24">
        <el-card>
          <template #header>
            <span>最近文章</span>
          </template>
          <el-table :data="recentArticles" v-loading="loading" style="width: 100%">
            <el-table-column prop="title" label="标题" />
            <el-table-column prop="tags" label="标签" width="200">
              <template #default="{ row }">
                <el-tag v-for="tag in row.tags.slice(0, 3)" :key="tag" size="small" class="tag-cell">
                  {{ tag }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="created_at" label="创建时间" width="150">
              <template #default="{ row }">
                {{ formatDate(row.created_at) }}
              </template>
            </el-table-column>
            <el-table-column label="操作" width="150">
              <template #default="{ row }">
                <el-button type="primary" link @click="editArticle(row.id)">
                  编辑
                </el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import api from '../../api'

const router = useRouter()

const stats = reactive({
  totalArticles: 0,
  totalTags: 0,
  recentArticles: 0
})

const recentArticles = ref([])
const loading = ref(false)

onMounted(() => {
  fetchDashboard()
})

// All dashboard numbers come from one endpoint so they always agree with
// each other, regardless of pagination limits or stored date formats
async function fetchDashboard() {
  loading.value = true
  try {
    const { data } = await api.get('/stats')
    stats.totalArticles = data.totalArticles
    stats.totalTags = data.totalTags
    stats.recentArticles = data.weeklyNewArticles
    recentArticles.value = data.recentArticles
  } catch (error) {
    console.error('Failed to fetch dashboard stats:', error)
    ElMessage.error('获取统计数据失败')
  } finally {
    loading.value = false
  }
}

function goToCreateArticle() {
  router.push('/admin/articles/new')
}

function goToArticleList() {
  router.push('/admin/articles')
}

function goToHome() {
  router.push('/')
}

function editArticle(id) {
  router.push(`/admin/articles/${id}/edit`)
}

function formatDate(dateStr) {
  const date = new Date(dateStr)
  return date.toLocaleDateString('zh-CN')
}
</script>

<style scoped>
.dashboard {
  padding-top: 20px;
}

.page-title {
  font-size: 24px;
  color: #303133;
  margin-bottom: 20px;
}

.stat-cards {
  margin-bottom: 20px;
}

.stat-item {
  text-align: center;
  padding: 20px 0;
}

.stat-number {
  font-size: 36px;
  font-weight: bold;
  color: #409eff;
}

.stat-label {
  font-size: 14px;
  color: #909399;
  margin-top: 8px;
}

.quick-actions {
  margin-bottom: 20px;
}

.recent-articles {
  margin-bottom: 20px;
}

.tag-cell {
  margin-right: 4px;
}
</style>
