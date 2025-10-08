<template>
  <div>
    <!-- 顶部用户菜单 -->
    <div class="user-menu-bar">
      <div class="user-avatar-wrapper"
           @mouseenter="showMenu = true"
           @mouseleave="showMenu = false">
        <div class="user-avatar">{{ usernameInitial }}</div>
        <transition name="fade">
          <div v-if="showMenu" class="user-dropdown">
            <div class="user-name">{{ username }}</div>
            <button class="logout-btn" @click="logout">登出</button>
          </div>
        </transition>
      </div>
    </div>
    <div class="center-page">
      <div class="container">
        <h2 class="title">收藏夹分组</h2>
        <div class="toolbar">
          <input v-model="searchText" class="search-input" placeholder="🔍 搜索分组/书签"/>
          <button class="add-group-btn" @click="showNewGroupDialog = true">＋ 新建分组</button>
          <button class="export-btn" @click="exportData">导出</button>
          <label class="import-label">
            导入
            <input type="file" accept="application/json" class="import-input" @change="importData" />
          </label>
          <button class="batch-btn" @click="batchMode = !batchMode">{{ batchMode ? '退出批量' : '批量操作' }}</button>
          <button v-if="batchMode" class="batch-delete-btn" @click="batchDelete" :disabled="!hasBatchSelected">批量删除</button>
          <button v-if="batchMode" class="batch-move-btn" @click="openBatchMoveDialog" :disabled="!hasBatchBookmarkSelected">批量移动</button>
        </div>
        <draggable
          v-model="groups"
          group="groups"
          item-key="id"
          :animation="220"
          class="groups-list"
          @end="onGroupsDragEnd"
        >
          <template #item="{element: group, index}">
            <div
               class="group-box"
              :style="{ background: group.color || '#f6f8fa' }"
              @mouseenter="group.hover = true"
              @mouseleave="group.hover = false"
              @dragover.prevent="onGroupBoxDragOver(group)"
              @drop="onGroupBoxDrop(group)"
            >
              <div class="group-header">
                <template v-if="!group.editing">
                  <span v-if="batchMode" class="checkbox">
                    <input type="checkbox" v-model="selectedGroups" :value="group.id" />
                  </span>
                  <span class="group-emoji" v-if="group.emoji" v-html="highlight(group.emoji)"></span>
                  <span class="group-title" v-html="highlight(group.name)"></span>
                  <button v-show="group.hover && !batchMode" class="edit-group-btn" @click="editGroup(group)">✎</button>
                </template>
                <template v-else>
                  <input class="group-edit-input" v-model="group.name" @keyup.enter="saveEditGroup(group)" @blur="saveEditGroup(group)"/>
                  <select v-model="group.emoji" class="emoji-select">
                    <option value="">无</option>
                    <option v-for="em in emojiList" :key="em" :value="em">{{ em }}</option>
                  </select>
                  <div class="color-palette">
                    <div v-for="c in appleColors" :key="c"
                      class="color-dot"
                      :style="{background: c, border: group.color === c ? '2px solid #222' : '2px solid #fff'}"
                      @click="selectGroupColor(group, c)"
                    ></div>
                  </div>
                </template>
                <button v-show="group.hover && !batchMode" class="delete-group-btn" @click="deleteGroup(group)">🗑</button>
              </div>
              <draggable
                v-model="group.bookmarks"
                group="bookmarks"
                item-key="id"
                :animation="180"
                class="bookmark-list"
                @start="onDragStartBookmark"
                @end="onBookmarksDragEnd"
              >
                <template #item="{element: bm, index: bmIdx}">
  <div class="bookmark-card" @mouseenter="bm.hover = true" @mouseleave="bm.hover = false">
  <span v-if="batchMode" class="checkbox">
    <input type="checkbox" v-model="selectedBookmarksMap[group.id]" :value="bm.id" />
  </span>
  <!-- 图标单独一栏，不参与跳转 -->
  <span>
    <img :src="bm.icon || 'https://favicon.yandex.net/favicon/www.baidu.com'" alt="icon" class="icon" />
  </span>
  <!-- 只有标题是a标签，点击蓝字才跳转 -->
  <a
    :href="bm.url"
    target="_blank"
    rel="noopener"
    class="card-title card-link"
    v-html="highlight(bm.title)"
    style="margin-left: 8px;"
  ></a>
  <div class="card-actions">
    <button class="edit-btn" v-if="!batchMode && bm.hover" @click="editBookmark(group, bm)">✎</button>
    <button class="delete-btn" v-if="!batchMode && bm.hover" @click="deleteBookmark(group, bm)">✕</button>
  </div>
</div>
</template>
              </draggable>
              <button
  v-if="!batchMode && group.hover && group.bookmarks.length < 3"
  class="add-bookmark-btn"
  @click="showAddBookmarkDialog(group)"
>
  ＋ 添加书签
</button>
            </div>
          </template>
        </draggable>
        <div v-if="isBookmarkDragging"
              class="empty-dropzone"
              @dragover.prevent
              @drop="onDropToEmpty"
        >
          <span>拖到这里新建分组</span>
        </div>
      </div>

      <!-- 批量移动弹窗 -->
      <div v-if="showBatchMoveDialog" class="dialog-mask no-bg">
        <div class="dialog">
          <h3>批量移动书签</h3>
          <div>请选择目标分组：</div>
          <select v-model="batchMoveTargetGroupId" class="dialog-input">
            <option v-for="g in moveAvailableGroups" :key="g.id" :value="g.id">{{ g.emoji }} {{g.name}}</option>
          </select>
          <div class="dialog-actions">
            <button @click="doBatchMove" :disabled="!batchMoveTargetGroupId">确定</button>
            <button @click="closeBatchMoveDialog">取消</button>
          </div>
        </div>
      </div>
      <div v-if="showAddBookmarkDialogFlag" class="dialog-mask no-bg">
        <div class="dialog">
          <h3>添加书签到分组: {{ addBookmarkTargetGroup?.name }}</h3>
          <input v-model="newBookmark.title" class="dialog-input" placeholder="标题"/>
          <input v-model="newBookmark.url" class="dialog-input" placeholder="链接" @blur="autoFillIcon"/>
          <input v-model="newBookmark.icon" class="dialog-input" placeholder="图标URL（可选）"/>
          <div class="dialog-actions">
            <button @click="addBookmark">确定</button>
            <button @click="cancelAddBookmark">取消</button>
          </div>
        </div>
      </div>
      <div v-if="showEditBookmarkDialogFlag" class="dialog-mask no-bg">
        <div class="dialog">
          <h3>编辑书签</h3>
          <input v-model="editBookmarkObj.title" class="dialog-input" placeholder="标题"/>
          <input v-model="editBookmarkObj.url" class="dialog-input" placeholder="链接" @blur="autoFillIconEdit"/>
          <input v-model="editBookmarkObj.icon" class="dialog-input" placeholder="图标URL（可选）"/>
          <div class="dialog-actions">
            <button @click="saveEditBookmark">确定</button>
            <button @click="cancelEditBookmark">取消</button>
          </div>
        </div>
      </div>
      <div v-if="showNewGroupDialog" class="dialog-mask no-bg">
        <div class="dialog">
          <h3>新建分组</h3>
          <div class="new-group-form">
            <input class="dialog-input" v-model="newGroupName" placeholder="分组名称"/>
            <select v-model="newGroupEmoji" class="emoji-select">
              <option value="">无</option>
              <option v-for="em in emojiList" :key="em" :value="em">{{ em }}</option>
            </select>
            <div class="color-palette">
              <div v-for="c in appleColors" :key="c"
                class="color-dot"
                :style="{background: c, border: newGroupColor === c ? '2px solid #222' : '2px solid #fff'}"
                @click="selectNewGroupColor(c)"
              ></div>
            </div>
          </div>
          <div class="dialog-actions">
            <button @click="addGroupWithBookmark">确定</button>
            <button @click="cancelNewGroupDialog">取消</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted,watch } from 'vue'
import draggable from 'vuedraggable'
import { useRouter } from 'vue-router'
const router = useRouter()

// 用户菜单相关
const showMenu = ref(false)
// 获取用户名（假设登录时存入 localStorage，或从后端获取）
const username = ref(localStorage.getItem('username') || '未登录')
const usernameInitial = computed(() =>
  username.value && username.value.length ? username.value[0].toUpperCase() : 'U'
)
function logout() {
  localStorage.removeItem('token')
  sessionStorage.removeItem('token')
  localStorage.removeItem('username')
  router.push('/login')
}

// 下面是原有业务逻辑
const appleColors = [
  "#E7EBF1", "#FFF2CC", "#FFE5D9", "#FFD6E0", "#E2D6FF",
  "#D1F5FF", "#B0D8F5", "#CDF5E7", "#D6F5D6", "#EADDC7"
]
const emojiList = [
  "📚", "🛠", "🎮", "🌐", "💡", "🎵", "🌟", "🚀", "📝", "❤️", "🔍", "🧩"
]

const groups = ref([])
const searchText = ref('')
const showNewGroupDialog = ref(false)
const newGroupName = ref('')
const newGroupEmoji = ref('')
const newGroupColor = ref(appleColors[0])
const showAddBookmarkDialogFlag = ref(false)
const addBookmarkTargetGroup = ref(null)
const newBookmark = ref({title:'', url:'', icon:''})
const showEditBookmarkDialogFlag = ref(false)
const editBookmarkObj = ref({})
const editBookmarkGroup = ref(null)
const draggedBookmarkObj = ref(null)
const isBookmarkDragging = ref(false)
const batchMode = ref(false)
const selectedGroups = ref([])
const selectedBookmarksMap = ref({})
const hasBatchSelected = computed(() =>
  selectedGroups.value.length > 0 || Object.values(selectedBookmarksMap.value).some(arr => arr && arr.length)
)
const hasBatchBookmarkSelected = computed(() =>
  Object.values(selectedBookmarksMap.value).some(arr => arr && arr.length)
)
const showBatchMoveDialog = ref(false)
const batchMoveTargetGroupId = ref(null)
const moveAvailableGroups = computed(() => {
  const selectedGroupIdsWithBookmark = Object.keys(selectedBookmarksMap.value).filter(gid => selectedBookmarksMap.value[gid] && selectedBookmarksMap.value[gid].length)
  return groups.value.filter(g => !selectedGroupIdsWithBookmark.includes(String(g.id)))
})

watch(showNewGroupDialog, (val) => {
  if (!val) {
    isBookmarkDragging.value = false
    draggedBookmarkObj.value = null
  }
})

// 获取token
function getToken() {
  return localStorage.getItem('token') || ''
}

async function fetchGroupsFromBackend() {
  const res = await fetch('/api/groups', {
    headers: { 'Authorization': `Bearer ${getToken()}` }
  })
  if (res.ok) {
    const groupArr = await res.json()
    // 拉取书签
    const br = await fetch('/api/bookmarks', {
      headers: { 'Authorization': `Bearer ${getToken()}` }
    })
    let bookmarks = []
    if (br.ok) bookmarks = await br.json()
    // 组装分组和书签
    for (const g of groupArr) {
      g.bookmarks = bookmarks.filter(bm => bm.group_id === g.id)
      g.editing = false
      g.hover = false
    }
    groups.value = groupArr
  } else if (res.status === 401) {
    localStorage.removeItem('token')
    router.push('/login')
  }
}

onMounted(fetchGroupsFromBackend)

function highlight(text) {
  if (!searchText.value.trim()) return text
  const s = searchText.value.trim()
  return text.replace(new RegExp(s, 'gi'), m => `<span class="highlight">${m}</span>`)
}

const filteredGroups = computed(() => {
  const s = searchText.value.trim().toLowerCase()
  if (!s) return groups.value
  return groups.value.map(group => {
    const groupMatched = group.name.toLowerCase().includes(s) || (group.emoji && group.emoji.includes(s))
    const bookmarks = group.bookmarks.filter(bm =>
      bm.title.toLowerCase().includes(s) ||
      bm.url.toLowerCase().includes(s)
    )
    if (groupMatched || bookmarks.length > 0) {
      return group
    }
    return null
  }).filter(Boolean)
})

function showBookmark(group, bm) {
  if (!searchText.value.trim()) return true
  const s = searchText.value.trim().toLowerCase()
  if (group.name.toLowerCase().includes(s) || (group.emoji && group.emoji.includes(s))) return true
  return bm.title.toLowerCase().includes(s) || bm.url.toLowerCase().includes(s)
}

// 新建分组
async function addGroupWithBookmark() {
  let bookmarks = []
  if (draggedBookmarkObj.value) bookmarks = [draggedBookmarkObj.value]
  const res = await fetch('/api/groups', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getToken()}`
    },
    body: JSON.stringify({
      name: newGroupName.value.trim(),
      emoji: newGroupEmoji.value,
      color: newGroupColor.value
    })
  })
  if (res.ok) {
    await fetchGroupsFromBackend()
    showNewGroupDialog.value = false
    isBookmarkDragging.value = false
    newGroupName.value = ''
    newGroupEmoji.value = ''
    newGroupColor.value = appleColors[0]
    // 新分组后如有拖拽书签，需再新建书签
    if (bookmarks.length) {
  const newGroup = groups.value[groups.value.length - 1];
  for (const bm of bookmarks) {
    await fetch(`/api/bookmarks/${bm.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getToken()}`
      },
      body: JSON.stringify({
        title: bm.title,
        url: bm.url,
        icon: bm.icon,
        group_id: newGroup.id
      })
    });
  }
  await fetchGroupsFromBackend();
}
draggedBookmarkObj.value = null;
  }
  isBookmarkDragging.value = false;
}

function onGroupBoxDragOver(group) {
  // 可选：在拖拽悬停时做点高亮提示，或什么都不做也行
}

async function onGroupBoxDrop(group) {
  // 只在有拖拽书签时响应
  if (!draggedBookmarkObj.value) return;
  // 如果拖拽的书签已经在该分组，则无需处理
  if (draggedBookmarkObj.value.group_id === group.id) return;

  // 更新书签的 group_id 到目标分组（即数据库归属到新分组）
  await fetch(`/api/bookmarks/${draggedBookmarkObj.value.id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getToken()}`
    },
    body: JSON.stringify({
      ...draggedBookmarkObj.value,
      group_id: group.id
    })
  });

  // 清理拖拽状态
  isBookmarkDragging.value = false;
  draggedBookmarkObj.value = null;

  // 刷新分组和书签显示
  await fetchGroupsFromBackend();
}

// 编辑分组
async function saveEditGroup(group) {
  group.editing = false
  await fetch(`/api/groups/${group.id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getToken()}`
    },
    body: JSON.stringify({
      name: group.name,
      emoji: group.emoji,
      color: group.color
    })
  })
  await fetchGroupsFromBackend()
}

async function onGroupsDragEnd(evt) {
  // groups.value 已经是新顺序
  const ids = groups.value.map(g => g.id)
  await fetch('/api/groups/sort', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getToken()}`
    },
    body: JSON.stringify({ ids })
  })
  // 保险：拉取最新分组数据，确保和后端一致
  await fetchGroupsFromBackend()
}

function selectGroupColor(group, color) {
  group.color = color
  saveEditGroup(group)
}

function selectNewGroupColor(color) {
  newGroupColor.value = color
}

function cancelNewGroupDialog() {
  showNewGroupDialog.value = false;
  isBookmarkDragging.value = false;
  draggedBookmarkObj.value = null;
}

// 删除分组
async function deleteGroup(group) {
  await fetch(`/api/groups/${group.id}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${getToken()}` }
  })
  await fetchGroupsFromBackend()
}

// 新建书签
function showAddBookmarkDialog(group) {
  addBookmarkTargetGroup.value = group
  showAddBookmarkDialogFlag.value = true
  newBookmark.value = {title:'', url:'', icon:''}
}

function autoFillIcon() {
  if (!newBookmark.value.url) return
  try {
    const urlObj = new URL(newBookmark.value.url)
    const domain = urlObj.hostname.replace(/^www\./, "")
    newBookmark.value.icon = `https://favicon.yandex.net/favicon/${domain}`
  } catch (e) {}
}

async function addBookmark() {
  if (!newBookmark.value.title.trim() || !newBookmark.value.url.trim()) return
  if (addBookmarkTargetGroup.value.bookmarks.length >= 3) return
  await fetch('/api/bookmarks', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getToken()}`
    },
    body: JSON.stringify({
      title: newBookmark.value.title,
      url: newBookmark.value.url,
      icon: newBookmark.value.icon,
      group_id: addBookmarkTargetGroup.value.id
    })
  })
  showAddBookmarkDialogFlag.value = false
  newBookmark.value = {title:'', url:'', icon:''}
  await fetchGroupsFromBackend()
}

function cancelAddBookmark() {
  showAddBookmarkDialogFlag.value = false
}

// 编辑书签弹窗
function editBookmark(group, bm) {
  editBookmarkObj.value = {...bm}
  editBookmarkGroup.value = group
  showEditBookmarkDialogFlag.value = true
}

function autoFillIconEdit() {
  if (!editBookmarkObj.value.url) return
  try {
    const urlObj = new URL(editBookmarkObj.value.url)
    const domain = urlObj.hostname.replace(/^www\./, "")
    editBookmarkObj.value.icon = `https://favicon.yandex.net/favicon/${domain}`
  } catch (e) {}
}

// 保存编辑书签
async function saveEditBookmark() {
  await fetch(`/api/bookmarks/${editBookmarkObj.value.id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getToken()}`
    },
    body: JSON.stringify({
      title: editBookmarkObj.value.title,
      url: editBookmarkObj.value.url,
      icon: editBookmarkObj.value.icon,
      group_id: editBookmarkGroup.value.id
    })
  })
  showEditBookmarkDialogFlag.value = false
  await fetchGroupsFromBackend()
}

function cancelEditBookmark() {
  showEditBookmarkDialogFlag.value = false
}

// 删除书签
async function deleteBookmark(group, bm) {
  await fetch(`/api/bookmarks/${bm.id}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${getToken()}` }
  })
  await fetchGroupsFromBackend()
}

// 拖拽分组结束
async function onBookmarksDragEnd(evt) {
  let movedBookmark = evt.item?._underlying_vm_;
  if (!movedBookmark) {
    isBookmarkDragging.value = false;
    draggedBookmarkObj.value = null;
    return;
  }
  let targetGroup = null;
  for (const g of groups.value) {
    if (g.bookmarks.some(bm => bm.id === movedBookmark.id)) {
      targetGroup = g;
      break;
    }
  }
  if (!targetGroup) {
    isBookmarkDragging.value = false;
    draggedBookmarkObj.value = null;
    return;
  }
  await fetch(`/api/bookmarks/${movedBookmark.id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getToken()}`
    },
    body: JSON.stringify({
      title: movedBookmark.title,
      url: movedBookmark.url,
      icon: movedBookmark.icon,
      group_id: targetGroup.id
    })
  });
  await fetchGroupsFromBackend();
  isBookmarkDragging.value = false;
  draggedBookmarkObj.value = null;
}

function onDragStartBookmark(evt) {
  // vuedraggable 的 evt.item._underlying_vm_ 是当前拖拽的书签对象
  draggedBookmarkObj.value = evt.item && evt.item._underlying_vm_ ? evt.item._underlying_vm_ : null
  isBookmarkDragging.value = true
}

function onDragEndBookmark() {
  isBookmarkDragging.value = false
  draggedBookmarkObj.value = null
}

function onDropToEmpty(ev) {
  isBookmarkDragging.value = false; // 保证弹窗出现时，空白区消失
  if (!draggedBookmarkObj.value) return;
  showNewGroupDialog.value = true;
  draggedBookmarkObj.value = null;
}

// 批量移动
async function doBatchMove() {
  if (!batchMoveTargetGroupId.value) return
  let movingBookmarks = []
  Object.entries(selectedBookmarksMap.value).forEach(([gid, arr]) => {
    if (arr && arr.length) {
      const group = groups.value.find(g => g.id == gid)
      if (group) {
        movingBookmarks.push(...group.bookmarks.filter(bm => arr.includes(bm.id)))
      }
    }
  })
  for (const bm of movingBookmarks) {
    await fetch(`/api/bookmarks/${bm.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getToken()}`
      },
      body: JSON.stringify({ ...bm, group_id: batchMoveTargetGroupId.value })
    })
  }
  selectedGroups.value = []
  selectedBookmarksMap.value = {}
  batchMode.value = false
  batchMoveTargetGroupId.value = null
  showBatchMoveDialog.value = false
  await fetchGroupsFromBackend()
}

function openBatchMoveDialog() {
  batchMoveTargetGroupId.value = moveAvailableGroups.value.length ? moveAvailableGroups.value[0].id : null
  showBatchMoveDialog.value = true
}
function closeBatchMoveDialog() {
  showBatchMoveDialog.value = false
  batchMoveTargetGroupId.value = null
}

// 批量删除
async function batchDelete() {
  // 删除分组
  for (const gid of selectedGroups.value) {
    await fetch(`/api/groups/${gid}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${getToken()}` }
    })
  }
  // 删除书签
  for (const arr of Object.values(selectedBookmarksMap.value)) {
    if (arr && arr.length) {
      for (const bmId of arr) {
        await fetch(`/api/bookmarks/${bmId}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${getToken()}` }
        })
      }
    }
  }
  selectedGroups.value = []
  selectedBookmarksMap.value = {}
  batchMode.value = false
  await fetchGroupsFromBackend()
}

// 导出分组和书签
function exportData() {
  const dataStr = JSON.stringify(groups.value, null, 2)
  const blob = new Blob([dataStr], {type: "application/json"})
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'bookmark_groups_backup.json'
  a.click()
  URL.revokeObjectURL(url)
}

// 导入分组和书签
async function importData(e) {
  const file = e.target.files[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = async (event) => {
    try {
      const json = JSON.parse(event.target.result)
      if (Array.isArray(json)) {
        // 分组
        for (const g of json) {
          const res = await fetch('/api/groups', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${getToken()}`
            },
            body: JSON.stringify({
              name: g.name,
              emoji: g.emoji,
              color: g.color
            })
          })
          if (res.ok) {
            const groupResp = await res.json()
            // 书签
            for (const bm of (g.bookmarks || [])) {
              await fetch('/api/bookmarks', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${getToken()}`
                },
                body: JSON.stringify({
                  title: bm.title,
                  url: bm.url,
                  icon: bm.icon,
                  group_id: groupResp.id
                })
              })
            }
          }
        }
        await fetchGroupsFromBackend()
      } else {
        alert('导入数据格式错误！')
      }
    } catch {
      alert('导入数据解析错误！')
    }
  }
  reader.readAsText(file)
}
</script>

<style scoped>
/* 用户菜单样式 */
.user-menu-bar {
  position: fixed;
  top: 24px;
  right: 42px;
  z-index: 9999;
}
.user-avatar-wrapper {
  position: relative;
  display: inline-block;
}
.user-avatar {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: #2466ff;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.28rem;
  font-weight: 700;
  cursor: pointer;
  box-shadow: 0 2px 8px #e3eafe;
  transition: box-shadow .18s;
}
.user-avatar:hover {
  box-shadow: 0 4px 16px #b8c8f8;
}
.user-dropdown {
  position: absolute;
  top: 54px;
  right: 0;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 2px 16px #e1e5ef;
  min-width: 120px;
  padding: 18px 22px 16px 22px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  animation: fadein .2s;
}
.user-name {
  font-weight: 600;
  font-size: 1rem;
  margin-bottom: 12px;
  color: #223;
}
.logout-btn {
  border: none;
  background: #ff3b30;
  color: #fff;
  padding: 8px 14px;
  border-radius: 7px;
  font-size: 0.98rem;
  cursor: pointer;
  font-weight: 500;
  transition: background .18s;
}
.logout-btn:hover {
  background: #d81d1d;
}
.fade-enter-active, .fade-leave-active { transition: opacity .18s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

/* 原始页面样式（未动） */
html, body, #app {
  margin: 0;
  padding: 0;
  width: 100vw;
  height: 100vh;
  box-sizing: border-box;
  background: linear-gradient(120deg, #e7ebf1 0%, #f5f7fa 100%);
  overflow: hidden;
}
.center-page {
  min-height: 100vh;
  width: 100vw;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}
.container {
  background: rgba(245,247,250,0.98);
  border-radius: 38px;
  box-shadow: 0 8px 42px 0 rgba(80,80,120,0.11);
  width: 88vw;           /* 卡片宽度占页面88% */
  height: 88vh;          /* 卡片高度占页面88% */
  max-width: 1400px;     /* 最大宽度限制 */
  min-width: 350px;
  margin: 42px auto;     /* 上下居中/四周留白 */
  padding: 56px 38px 56px 38px; /* 四周内边距，显得更大更宽松 */
  display: flex;
  flex-direction: column;
  align-items: center;
  box-sizing: border-box;
}
@media (max-width: 900px) {
  .container {
    width: 98vw;
    max-width: 99vw;
    min-width: 0;
    padding: 18px 2vw;
    border-radius: 18px;
    margin: 12px auto;
  }
}
.title {
  font-size: 1.45rem;
  font-weight: 700;
  text-align: center;
  margin-bottom: 12px;
  letter-spacing: 1px;
  color: #222;
}
.toolbar {
  display: flex;
  flex-direction: row;
  gap: 32px; /* 按钮间距适当加大 */
  align-items: center;
  justify-content: center;
  margin-bottom: 26px;
  flex-wrap: wrap;
}
.toolbar button,
.toolbar label {
  min-width: 52px;
  padding: 5px 12px;
  font-size: 0.95rem;
  border-radius: 8px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.05);
  background: linear-gradient(90deg,#e3e6ed,#f7f7f9);
  border: none;
  cursor: pointer;
  font-weight: 500;
}
.toolbar label {
  display: inline-flex;
  align-items: center;
  cursor: pointer;
  user-select: none;
  position: relative;
}
.import-input {
  display: none;
}
.batch-btn, .batch-delete-btn, .batch-move-btn {
  background: linear-gradient(90deg,#e3e6ed,#f7f7f9);
  border-radius: 8px;
  padding: 5px 12px;
  font-size: 0.95rem;
  margin-left: 0;
}
.batch-delete-btn:disabled,
.batch-move-btn:disabled {
  background: #ececec;
  color: #aaa;
  cursor: not-allowed;
}
.checkbox {
  margin-right: 4px;
  display: inline-block;
  vertical-align: middle;
}
.search-input {
  background: #ececec;
  border: none;
  outline: none;
  border-radius: 10px;
  font-size: 0.97rem;
  padding: 6px 14px;
  max-width: 200px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.04);
}
.add-group-btn {
  background: linear-gradient(90deg,#e3e6ed,#f7f7f9);
  border: none;
  border-radius: 8px;
  padding: 7px 14px;
  font-size: 1rem;
  cursor: pointer;
  box-shadow: 0 1px 4px rgba(0,0,0,0.04);
  font-weight: 500;
}
.groups-list {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  align-items: flex-start;
  gap: 34px 38px;     /* 行距和列距更大 */
  width: 100%;
  max-width: 1080px;  /* 4个卡片一行，卡片宽度270px，间距38px，正好一行 */
  margin: 0 auto;
  min-height: 520px;  /* 3行 × 170px卡片高度 + 间距，正好一页 */
}

.group-box {
  position: relative;
  width: 240px;       /* 卡片再放大一点 */
  min-width: 240px;
  max-width: 240px;
  height: 170px;
  min-height: 170px;
  max-height: 170px;
  box-sizing: border-box;
  border-radius: 18px;
  box-shadow: 0 8px 32px rgba(80,80,120,0.11);
  padding: 18px 14px 14px 14px;
  display: flex;
  flex-direction: column;
  gap: 18px;
  background: var(--group-bg, #f6f8fa);
  transition: background 0.2s, box-shadow 0.2s;
}

.group-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 2px;
}
.group-title {
  font-size: 0.97rem;
  font-weight: 700;
  color: #223;
  word-break: break-all;
}
.group-emoji {
  font-size: 1.2rem;
  margin-right: 2px;
}
.edit-group-btn, .delete-group-btn {
  background: none;
  border: none;
  cursor: pointer;
  border-radius: 8px;
  font-size: 0.93rem;
  padding: 2px 5px;
  transition: background 0.18s;
}
.edit-group-btn:hover {
  background: #e5f0ff;
}
.delete-group-btn {
  color: #ff3b30;
}
.delete-group-btn:hover {
  background: #ffeaea;
}
.group-edit-input {
  border: none;
  background: #ececec;
  border-radius: 8px;
  padding: 4px 7px;
  font-size: 0.97rem;
  margin-right: 6px;
}
.emoji-select {
  font-size: 0.97rem;
  margin-right: 6px;
  border-radius: 8px;
  padding: 2px 4px;
  border: 1px solid #ddd;
  background: #f9fafb;
}
.color-palette {
  display: flex;
  gap: 7px;
  align-items: center;
  flex-wrap: wrap;
  margin-top: 4px;
}
.color-dot {
  width: 19px;
  height: 19px;
  border-radius: 100px;
  cursor: pointer;
  box-shadow: 0 1px 5px rgba(80,80,120,0.08);
  border: 2px solid #fff;
  transition: box-shadow 0.18s, border 0.18s;
}
.color-dot:hover {
  box-shadow: 0 2px 7px rgba(80,80,120,0.11);
  border: 2px solid #2466ff !important;
}
.bookmark-list {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding-top: 4px;
}
.bookmark-card {
  background: #fff !important; /* 纯白底！ */
  border-radius: 10px;
  box-shadow: 0 2px 8px rgba(80,80,120,0.09);
  padding: 10px 12px;
  margin-bottom: 8px; /* 卡片之间有间距 */
  min-height: 32px;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 10px;
  transition: box-shadow 0.18s, background 0.18s;
  position: relative;
}
.bookmark-card:hover {
  box-shadow: 0 4px 12px rgba(80,80,120,0.13);
  background: #f4f6fa;
}
.card-link {
  display: inline;
  text-decoration: none;
  color: #2466ff;
  font-weight: 500;
  /* 不要有 flex、gap、align-items、width 等属性！ */
}
.card-title { font-size: 0.97rem; }
.icon { width: 16px; height: 16px; border-radius: 3px; object-fit: cover; background: #fff; }
.card-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}
.edit-btn, .delete-btn {
  background: none;
  border: none;
  cursor: pointer;
  border-radius: 6px;
  font-size: 0.97rem;
  padding: 2px 6px;
  transition: background 0.18s;
}
.edit-btn { color: #0a84ff;}
.edit-btn:hover { background: #e5f0ff;}
.delete-btn { color: #ff3b30;}
.delete-btn:hover { background: #ffeaea;}
.card-link {
  display: flex;
  align-items: center;
  gap: 5px;
  text-decoration: none;
  color: #2466ff;
}
.card-title { font-size: 0.93rem; }
.icon { width: 13px; height: 13px; border-radius: 3px; object-fit: cover; background: #fff; }
.card-actions {
  display: flex;
  gap: 2px;
  align-items: center;
}
.edit-btn, .delete-btn {
  background: none;
  border: none;
  cursor: pointer;
  border-radius: 6px;
  font-size: 0.93rem;
  padding: 1px 4px;
  transition: background 0.18s;
}
.edit-btn { color: #0a84ff;}
.edit-btn:hover { background: #e5f0ff;}
.delete-btn { color: #ff3b30;}
.delete-btn:hover { background: #ffeaea;}
.add-bookmark-btn {
  background: #ececec;
  border-radius: 7px;
  border: none;
  padding: 4px 0;
  font-size: .89rem;
  cursor: pointer;
  margin-top: 2px;
}
.empty-dropzone {
  border: 2px dashed #e3e6ed;
  border-radius: 12px;
  padding: 16px 0;
  margin: 10px 0;
  text-align: center;
  color: #888;
  font-size: 0.95rem;
  background: #f6f8fa;
  transition: opacity 0.2s;
}
.highlight {
  background: #ffe066;
  border-radius: 3px;
  padding: 0 2px;
}
.dialog-mask {
  position: fixed;
  left: 0; top: 0;
  width: 100vw;
  height: 100vh;
  z-index: 999;
  background: none;
  display: flex;
  align-items: center;
  justify-content: center;
}
.dialog-mask.no-bg {
  background: none !important;
}
.dialog {
  background: rgba(255,255,255,0.96);
  border-radius: 13px;
  box-shadow: 0 3px 20px rgba(80,80,120,0.10);
  min-width: 220px;
  max-width: 94vw;
  width: 260px;
  max-height: 90vh;
  overflow-y: auto;
  padding: 18px 12px;
  display: flex;
  flex-direction: column;
  gap: 13px;
  box-sizing: border-box;
}
.dialog-input {
  border: none;
  background: #ececec;
  border-radius: 7px;
  padding: 5px 9px;
  font-size: 0.97rem;
}
.dialog-actions {
  display: flex;
  gap: 10px;
  margin-top: 3px;
  justify-content: flex-end;
}
.dialog-actions button {
  background: linear-gradient(90deg,#e3e6ed,#f7f7f9);
  border: none;
  border-radius: 8px;
  padding: 5px 11px;
  font-size: 0.97rem;
  cursor: pointer;
  font-weight: 500;
}
.dialog-actions button:hover {
  background: linear-gradient(90deg,#d7eaff,#e3f0ff);
}
.new-group-form {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
  flex-wrap: wrap;
}
</style>