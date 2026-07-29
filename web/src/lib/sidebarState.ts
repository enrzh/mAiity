const KEY = 'maps.sidebar.collapsed'
type StorageLike = Pick<Storage, 'getItem' | 'setItem'>

export function readSidebarCollapsed(storage: StorageLike = localStorage): boolean {
  return storage.getItem(KEY) === '1'
}

export function writeSidebarCollapsed(collapsed: boolean, storage: StorageLike = localStorage) {
  storage.setItem(KEY, collapsed ? '1' : '0')
}
