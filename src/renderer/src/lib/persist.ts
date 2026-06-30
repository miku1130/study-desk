export const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T

export async function loadStore<T>(name: string): Promise<T> {
  return (await window.api.store.get<T>(name)) as T
}

export async function saveStore(name: string, value: unknown): Promise<void> {
  await window.api.store.set(name, clone(value))
}
