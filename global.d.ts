declare module '*.png' {
  const value: import('react-native').ImageSourcePropType
  export default value
}

declare module '*.jpeg' {
  const value: import('react-native').ImageSourcePropType
  export default value
}

declare var global: {
  __SolProxy: {
    setHeight: (height: number) => void
    resetWindowSize: () => void
    hideWindow: () => void
    searchFiles: (query: string) => void
  }
}
