import {GiphyFetch} from '@giphy/js-fetch-api'
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as Sentry from '@sentry/react-native'
import {Assets, Icons} from 'assets'
import Chance from 'chance'
import clsx from 'clsx'
import {FileIcon} from 'components/FileIcon'
import {FUSE_OPTIONS} from 'config'
import {Parser} from 'expr-eval'
import Fuse from 'fuse.js'
import {CONSTANTS} from 'lib/constants'
import {allEmojis, emojiFuse, EMOJIS_PER_ROW} from 'lib/emoji'
import {GithubRepo, searchGithubRepos} from 'lib/github'
import {solNative} from 'lib/SolNative'
import {googleTranslate} from 'lib/translator'
import {getWeather} from 'lib/weather'
import {debounce} from 'lodash'
import {DateTime} from 'luxon'
import {autorun, makeAutoObservable, runInAction, toJS} from 'mobx'
import {nanoid} from 'nanoid'
import React from 'react'
import {
  Alert,
  Appearance,
  Clipboard,
  DevSettings,
  EmitterSubscription,
  Image,
  Linking,
  Platform,
  Text,
  View,
} from 'react-native'
import {IRootStore} from 'store'
import {v4 as uuidv4} from 'uuid'
import {systemPreferenceItems} from './systemPreferences'

const chance = new Chance()
const gf = new GiphyFetch('Ot4kWfqWddVroUVh73v4Apocs8Dek86j')

let onShowListener: EmitterSubscription | undefined
let onHideListener: EmitterSubscription | undefined
let onFileSearchListener: EmitterSubscription | undefined

const exprParser = new Parser()

export enum Widget {
  ONBOARDING = 'ONBOARDING',
  SEARCH = 'SEARCH',
  CALENDAR = 'CALENDAR',
  PROJECT_CREATION = 'PROJECT_CREATION',
  PROJECT_SELECT = 'PROJECT_SELECT',
  TRANSLATION = 'TRANSLATION',
  SETTINGS = 'SETTINGS',
  CREATE_ITEM = 'CREATE_ITEM',
  GOOGLE_MAP = 'GOOGLE_MAP',
  SCRATCHPAD = 'SCRATCHPAD',
  EMOJIS = 'EMOJIS',
  GIFS = 'GIFS',
  CLIPBOARD = 'CLIPBOARD',
}

export enum ItemType {
  APPLICATION = 'APPLICATION',
  CONFIGURATION = 'CONFIGURATION',
  CUSTOM = 'CUSTOM',
  TEMPORARY_RESULT = 'TEMPORARY_RESULT',
  BOOKMARK = 'BOOKMARK',
}

export type UIStore = ReturnType<typeof createUIStore>

export const createUIStore = (root: IRootStore) => {
  const persist = async () => {
    const plainState = toJS(store)

    AsyncStorage.setItem('@ui.store', JSON.stringify(plainState))
  }

  let hydrate = async () => {
    const storeState = await AsyncStorage.getItem('@ui.store')

    if (storeState) {
      let parsedStore = JSON.parse(storeState)

      runInAction(() => {
        store.frequencies = parsedStore.frequencies
        store.projects = parsedStore.projects
        store.currentlyTrackedProjectId = parsedStore.currentlyTrackedProjectId
        store.weatherApiKey = parsedStore.weatherApiKey
        store.weatherLat = parsedStore.weatherLat
        store.weatherLon = parsedStore.weatherLon
        store.onboardingStep = parsedStore.onboardingStep
        store.firstTranslationLanguage =
          parsedStore.firstTranslationLanguage ?? 'en'
        store.secondTranslationLanguage =
          parsedStore.secondTranslationLanguage ?? 'de'
        store.thirdTranslationLanguage =
          parsedStore.thirdTranslationLanguage ?? null
        store.customItems = parsedStore.customItems ?? []
        store.favorites = parsedStore.favorites ?? []
        if (
          store.onboardingStep !== 'v1_completed' &&
          store.onboardingStep !== 'v1_skipped'
        ) {
          store.focusedWidget = Widget.ONBOARDING
        }
        store.note = parsedStore.note ?? ''
        // temporary code to prevent loss of data
        if (parsedStore.notes) {
          store.note = parsedStore.notes.reduce((acc: string, n: string) => {
            return acc + '\n' + n
          }, '')
        }
        store.globalShortcut = parsedStore.globalShortcut
        store.scratchpadShortcut = parsedStore.scratchpadShortcut ?? 'command'
        store.clipboardManagerShortcut =
          parsedStore.clipboardManagerShortcut ?? 'shift'
        store.frequentlyUsedEmojis = parsedStore.frequentlyUsedEmojis ?? {}
        store.githubSearchEnabled = parsedStore.githubSearchEnabled ?? false
        store.githubToken = parsedStore.githubToken ?? null
        store.showWindowOn = parsedStore.showWindowOn ?? 'screenWithFrontmost'
        store.windowManagementEnabled =
          parsedStore.windowManagementEnabled ?? true
        store.calendarEnabled = parsedStore.calendarEnabled ?? true
        store.showAllDayEvents = parsedStore.showAllDayEvents ?? true
        store.launchAtLogin = parsedStore.launchAtLogin ?? true
        store.useBackgroundOverlay = parsedStore.useBackgroundOverlay ?? true
        store.shouldHideMenubar = parsedStore.shouldHideMenuBar ?? false
        store.spotifyForwardingEnabled =
          parsedStore.spotifyForwardingEnabled ?? true
      })

      solNative.setLaunchAtLogin(parsedStore.launchAtLogin ?? true)
      solNative.setGlobalShortcut(parsedStore.globalShortcut)
      solNative.setScratchpadShortcut(parsedStore.scratchpadShortcut)
      solNative.setClipboardManagerShortcut(
        parsedStore.clipboardManagerShortcut,
      )
      solNative.setShowWindowOn(
        parsedStore.showWindowOn ?? 'screenWithFrontmost',
      )
      solNative.setWindowManagement(store.windowManagementEnabled)
      solNative.useBackgroundOverlay(store.useBackgroundOverlay)
      solNative.shouldHideMenubar(store.shouldHideMenubar)
      solNative.setSpotifyForwardingEnabled(store.spotifyForwardingEnabled)
    } else {
      runInAction(() => {
        store.focusedWidget = Widget.ONBOARDING
      })
    }
  }

  const FALLBACK_ITEMS: Item[] = [
    {
      iconImage: Assets.googleLogo,
      name: 'Google Search',
      type: ItemType.CONFIGURATION,
      shortcut: '⌘ 1',
      callback: () => {
        Linking.openURL(
          `https://google.com/search?q=${encodeURIComponent(store.query)}`,
        )
      },
    },
    {
      iconImage: Assets.googleTranslateLogo,
      name: 'Google Translate',
      type: ItemType.CONFIGURATION,
      callback: () => {
        store.translateQuery()
      },
      shortcut: '⌘ 2',
      preventClose: true,
    },
    {
      iconImage: Assets.GoogleMaps,
      name: 'Google Maps',
      type: ItemType.CONFIGURATION,
      callback: () => {
        store.focusedWidget = Widget.GOOGLE_MAP
      },
      shortcut: '⌘ 3',
      preventClose: true,
    },
  ]

  let ITEMS: Item[] = [
    {
      icon: '⏰',
      name: 'Track time',
      type: ItemType.CONFIGURATION,
      preventClose: true,
      callback: () => {
        store.focusWidget(Widget.PROJECT_SELECT)
      },
    },
    {
      icon: '✋',
      name: 'Stop Tracking Time',
      type: ItemType.CONFIGURATION,
      preventClose: true,
      callback: () => {
        store.stopTrackingProject()
      },
    },
    {
      icon: '➕',
      name: 'Create Tracking Project',
      type: ItemType.CONFIGURATION,
      preventClose: true,
      callback: () => {
        store.showProjectCreationForm()
      },
    },
    {
      iconImage: Assets.DarkModeIcon,
      name: 'Toogle OS theme',
      alias: 'dark',
      type: ItemType.CONFIGURATION,
      callback: () => {
        solNative.toggleDarkMode()
      },
    },
    {
      iconImage: Assets.SleepIcon,
      name: 'Sleep',
      type: ItemType.CONFIGURATION,
      callback: () => {
        solNative.executeAppleScript('tell application "Finder" to sleep')
      },
    },
    {
      icon: '🖥️',
      name: 'Restart Mac',
      type: ItemType.CONFIGURATION,
      callback: () => {
        solNative.executeAppleScript('tell application "Finder" to restart')
      },
    },
    {
      icon: '🌑',
      name: 'Power off Mac',
      type: ItemType.CONFIGURATION,
      callback: () => {
        solNative.executeAppleScript('tell application "Finder" to shut down')
      },
    },
    {
      iconImage: Assets.Airdrop,
      name: 'AirDrop',
      type: ItemType.CONFIGURATION,
      callback: () => {
        solNative.executeAppleScript(`tell application "Finder"
          if exists window "AirDrop" then
                  tell application "System Events" to ¬
                          tell application process "Finder" to ¬
                                  perform action "AXRaise" of ¬
                                          (windows whose title is "AirDrop")
          else if (count Finder windows) > 0 then
                  make new Finder window
                  tell application "System Events" to ¬
                          click menu item "AirDrop" of menu 1 of menu bar item ¬
                                  "Go" of menu bar 1 of application process "Finder"
          else
                  tell application "System Events" to ¬
                          click menu item "AirDrop" of menu 1 of menu bar item ¬
                                  "Go" of menu bar 1 of application process "Finder"
          end if
          activate
        end tell`)
      },
    },
    {
      iconImage: Assets.LockIcon,
      name: 'Lock',
      shortcut: '⌘ ⌥ Q',
      type: ItemType.CONFIGURATION,
      callback: () => {
        solNative.executeAppleScript(
          `tell application "System Events" to keystroke "q" using {control down, command down}`,
        )
      },
    },
    {
      iconComponent: () => {
        const colorScheme = Appearance.getColorScheme()

        return (
          <Image
            source={Assets.SolWhiteSmall}
            className={clsx('w-4 h-4', {
              tintColor: colorScheme === 'dark' ? 'white' : 'black',
            })}
          />
        )
      },
      name: 'Settings',
      type: ItemType.CONFIGURATION,
      callback: () => {
        store.focusWidget(Widget.SETTINGS)
      },
      preventClose: true,
    },
    {
      icon: '✳️',
      name: 'Create shortcut',
      type: ItemType.CONFIGURATION,
      callback: () => {
        store.focusWidget(Widget.CREATE_ITEM)
      },
      preventClose: true,
    },
    {
      iconComponent: () => {
        return (
          <View className="w-4 h-4 p-2 rounded items-start bg-black">
            <View className="w-3  h-3 p-1 rounded-sm bg-white" />
          </View>
        )
      },
      name: 'Resize window to full-screen',
      type: ItemType.CONFIGURATION,
      callback: () => {
        solNative.resizeFrontmostFullscreen()
      },
      shortcut: '^ ⌥ ↩',
    },
    {
      iconComponent: () => {
        return (
          <View className="w-4 h-4 p-2 rounded items-end bg-black">
            <View className="w-1 h-3 p-1 rounded-sm bg-white" />
          </View>
        )
      },
      name: 'Resize window to right-half',
      type: ItemType.CONFIGURATION,
      callback: () => {
        solNative.resizeFrontmostRightHalf()
      },
      shortcut: '^ ⌥ →',
    },
    {
      iconComponent: () => {
        return (
          <View className="w-4 h-4 p-2 rounded items-start bg-black">
            <View className="w-1 h-3 p-1 rounded-sm bg-white" />
          </View>
        )
      },
      name: 'Resize window to left-half',
      type: ItemType.CONFIGURATION,
      callback: () => {
        solNative.resizeFrontmostLeftHalf()
      },
      shortcut: '^ ⌥ ←',
    },
    {
      iconComponent: () => {
        return (
          <View className="w-4 h-4 p-2 rounded items-start bg-black">
            <View className="w-1 h-3 p-1 rounded-sm bg-white" />
          </View>
        )
      },
      name: 'Resize window to top-half',
      type: ItemType.CONFIGURATION,
      callback: () => {
        solNative.resizeFrontmostTopHalf()
      },
      shortcut: '^ ⌥ ↑',
    },
    {
      iconComponent: () => {
        return (
          <View className="w-4 h-4 p-2 rounded items-start bg-black">
            <View className="w-1 h-3 p-1 rounded-sm bg-white" />
          </View>
        )
      },
      name: 'Resize window to bottom-half',
      type: ItemType.CONFIGURATION,
      callback: () => {
        solNative.resizeFrontmostBottomHalf()
      },
      shortcut: '^ ⌥ ↓',
    },
    {
      iconComponent: () => {
        return (
          <View className="w-4 h-4 p-2 rounded items-start bg-black">
            <View className="w-1 h-1 p-1 rounded-sm bg-white" />
          </View>
        )
      },
      name: 'Resize window to top-left',
      type: ItemType.CONFIGURATION,
      callback: () => {
        solNative.resizeTopLeft()
      },
      shortcut: '^ ⌥ U',
    },
    {
      iconComponent: () => {
        return (
          <View className="w-4 h-4 p-2 rounded items-end bg-black">
            <View className="w-1 h-1 p-1 rounded-sm bg-white" />
          </View>
        )
      },
      name: 'Resize window to top-right',
      type: ItemType.CONFIGURATION,
      callback: () => {
        solNative.resizeTopRight()
      },
      shortcut: '^ ⌥ I',
    },
    {
      iconComponent: () => {
        return (
          <View className="w-4 h-4 p-2 rounded items-start justify-end bg-black">
            <View className="w-1 h-1 p-1 rounded-sm bg-white" />
          </View>
        )
      },
      name: 'Resize window to bottom-left',
      type: ItemType.CONFIGURATION,
      callback: () => {
        solNative.resizeBottomLeft()
      },
      shortcut: '^ ⌥ J',
    },
    {
      iconComponent: () => {
        return (
          <View className="w-4 h-4 p-2 rounded items-end justify-end bg-black">
            <View className="w-1 h-1 p-1 rounded-sm bg-white" />
          </View>
        )
      },
      name: 'Resize window to bottom-right',
      type: ItemType.CONFIGURATION,
      callback: () => {
        solNative.resizeBottomRight()
      },
      shortcut: '^ ⌥ K',
    },
    {
      iconComponent: () => {
        return (
          <View className="w-4 h-4 rounded items-center justify-center bg-black">
            <Text className="text-white">→</Text>
          </View>
        )
      },
      name: 'Move window to next screen',
      type: ItemType.CONFIGURATION,
      callback: () => {
        solNative.moveFrontmostNextScreen()
      },
      shortcut: '^ ⌥ ⌘ →',
    },
    {
      iconComponent: () => {
        return (
          <View className="w-4 h-4 rounded items-center justify-center bg-black">
            <Text className="text-white">←</Text>
          </View>
        )
      },
      name: 'Move window to previous screen',
      type: ItemType.CONFIGURATION,
      callback: () => {
        solNative.moveFrontmostPrevScreen()
      },
      shortcut: '^ ⌥ ⌘ ←',
    },
    {
      icon: '🖊',
      name: 'Scratchpad',
      preventClose: true,
      type: ItemType.CONFIGURATION,
      callback: () => {
        store.focusWidget(Widget.SCRATCHPAD)
      },
      shortcut: '⌘ + ⇧ + Space',
    },
    {
      icon: '😎',
      name: 'Emoji Picker',
      preventClose: true,
      type: ItemType.CONFIGURATION,
      callback: () => {
        store.showEmojiPicker()
      },
      shortcut: '⌘ + ^ + Space',
    },
    {
      icon: '😂',
      name: 'Search Gif',
      preventClose: true,
      type: ItemType.CONFIGURATION,
      callback: () => {
        store.showGifPicker()
      },
      // shortcut: '⌘ + ^ + Space',
    },
    {
      icon: '🆙',
      name: 'Check for updates',
      type: ItemType.CONFIGURATION,
      callback: () => {
        solNative.checkForUpdates()
      },
    },
    {
      icon: '📋',
      name: 'Clipboard Manager',
      type: ItemType.CONFIGURATION,
      callback: () => {
        store.showClipboardManager()
      },
      preventClose: true,
    },
    {
      iconComponent: () => <FileIcon url="~/Downloads" className="w-4 h-4" />,
      name: 'Downloads',
      type: ItemType.CONFIGURATION,
      callback: () => {
        Linking.openURL('~/Downloads')
      },
    },
    {
      iconComponent: () => <FileIcon url="/Applications" className="w-4 h-4" />,
      name: 'Applications',
      alias: 'application',
      type: ItemType.CONFIGURATION,
      callback: () => {
        Linking.openURL('/Applications')
      },
    },
    {
      iconComponent: () => <FileIcon url="~/Pictures" className="w-4 h-4" />,
      name: 'Pictures',
      type: ItemType.CONFIGURATION,
      callback: () => {
        Linking.openURL('~/Pictures')
      },
    },
    {
      iconComponent: () => <FileIcon url="~/Developer" className="w-4 h-4" />,
      name: 'Developer',
      type: ItemType.CONFIGURATION,
      callback: () => {
        Linking.openURL('~/Developer')
      },
    },
    {
      iconComponent: () => <FileIcon url="~/Documents" className="w-4 h-4" />,
      name: 'Documents',
      type: ItemType.CONFIGURATION,
      callback: () => {
        Linking.openURL('~/Documents')
      },
    },
    {
      iconImage: Assets.googleLogo,
      name: 'Start Google Meet',
      type: ItemType.CONFIGURATION,
      callback: async () => {
        await Linking.openURL(`https://meet.google.com/new`)

        solNative.executeAppleScript(`if application "Safari" is running then
          delay 3
          tell application "Safari"
            set myurl to URL of front document as string
          end tell

          set baseUrl to "https://meet.google.com/new"

          if (myurl contains baseUrl) then
            delay 3
            tell application "Safari"
              set myurl to URL of front document as string
            end tell
          else
            set the clipboard to myurl as string
            display notification "Google Meet link copied to clipboard" with title "Link Copied" sound name "Frog"
            return
          end if

          if (myurl contains baseUrl) then
            delay 3
            tell application "Safari"
              set myurl to URL of front document as string
            end tell
          else
            set the clipboard to myurl as string
            display notification "Google Meet link copied to clipboard" with title "Link Copied" sound name "Frog"
            return
          end if

          if (myurl contains baseUrl) then
            delay 3
            tell application "Safari"
              set myurl to URL of front document as string
            end tell
          else
            set the clipboard to myurl as string
            display notification "Google Meet link copied to clipboard" with title "Link Copied" sound name "Frog"
            return
          end if
          
          if (myurl contains baseUrl) then
            display notification "Google Meet could not be copied" with title "Couldn't copy Google Meet link" sound name "Frog"
          else
            set the clipboard to myurl as string
            display notification "Google Meet link copied to clipboard" with title "Link Copied" sound name "Frog"
          end if
        end if
        `)
      },
    },
    {
      icon: '🙉',
      name: 'Toggle do not disturb',
      type: ItemType.CONFIGURATION,
      callback: () => {
        solNative.toggleDND()
        solNative.showToast('✅ Toggled')
      },
    },
    {
      iconComponent: () => (
        <FileIcon url="/Applications/Xcode.app" className="w-4 h-4" />
      ),
      name: 'Remove derived data folder',
      type: ItemType.CONFIGURATION,
      callback: async () => {
        await solNative.executeBashScript(
          'rm -rf ~/Library/Developer/Xcode/DerivedData',
        )

        solNative.showToast('✅ Cleared')
      },
    },
    {
      icon: '🍔',
      name: 'Generate Unique ID (NanoID)',
      type: ItemType.CONFIGURATION,
      callback: async () => {
        const id = nanoid()
        solNative.pasteToFrontmostApp(id)
        solNative.showToast('✅ Generated and pasted')
      },
    },
    {
      icon: '🍔',
      name: 'Generate UUID',
      type: ItemType.CONFIGURATION,
      callback: async () => {
        const id = uuidv4()
        solNative.pasteToFrontmostApp(id)
        solNative.showToast('✅ Generated and pasted')
      },
    },
    {
      icon: '👴',
      name: 'Generate Lorem Ipsum',
      type: ItemType.CONFIGURATION,
      callback: async () => {
        const paragraph = chance.paragraph()
        solNative.pasteToFrontmostApp(paragraph)
        solNative.showToast('✅ Generated')
      },
    },
    {
      icon: '💀',
      name: 'Quit/Exit Sol',
      type: ItemType.CONFIGURATION,
      callback: async () => {
        solNative.quit()
      },
    },
    {
      icon: '📟',
      name: 'Paste as JSON',
      type: ItemType.CONFIGURATION,
      callback: async () => {
        let latestString = await Clipboard.getString()
        if (latestString)
          try {
            latestString = JSON.parse(latestString)
            solNative.pasteToFrontmostApp(JSON.stringify(latestString, null, 2))
            solNative.showToast('Pasted! ✅')
          } catch (e) {
            solNative.pasteToFrontmostApp(latestString)
            solNative.showToast('Not a valid JSON ❌')
          }
      },
    },
    {
      icon: '☠️',
      name: 'Kill all apps',
      type: ItemType.CONFIGURATION,
      callback: async () => {
        solNative.executeAppleScript(`-- get list of open apps
        tell application "System Events"
          set allApps to displayed name of (every process whose background only is false) as list
        end tell
        
        -- leave some apps open 
        set exclusions to {"AppleScript Editor", "Automator", "Finder", "LaunchBar"}
        
        -- quit each app
        repeat with thisApp in allApps
          set thisApp to thisApp as text
          if thisApp is not in exclusions then
            tell application thisApp to quit
          end if
        end repeat
        `)
      },
    },
    ...systemPreferenceItems,
  ]

  if (Platform.OS === 'windows') {
    ITEMS = [
      {
        iconImage: Assets.DarkModeIcon,
        name: 'Dark mode',
        type: ItemType.CONFIGURATION,
        callback: () => {
          solNative.toggleDarkMode()
        },
      },
    ]
  }

  if (__DEV__) {
    ITEMS.push({
      icon: '🐣',
      name: '[DEV] Restart onboarding',
      type: ItemType.CONFIGURATION,
      callback: () => {
        store.onboardingStep = 'v1_start'
        store.focusWidget(Widget.ONBOARDING)
      },
      preventClose: true,
    })

    ITEMS.push({
      icon: '💥',
      name: '[DEV] Reload',
      type: ItemType.CONFIGURATION,
      callback: () => {
        DevSettings.reload()
      },
      preventClose: true,
    })

    ITEMS.push({
      icon: '🧨',
      name: 'Sentry Crash',
      type: ItemType.CONFIGURATION,
      callback: () => {
        Sentry.captureMessage('Hello sentry')
        // Sentry.nativeCrash()
      },
    })
    ITEMS.push({
      icon: '🍞',
      name: 'Test toast',
      type: ItemType.CONFIGURATION,
      callback: () => {
        solNative.showToast(
          'This is a Toast test with a long test to make sure everything fits! 🍞',
        )
      },
    })
  }

  let store = makeAutoObservable({
    //    ____  _                              _     _
    //   / __ \| |                            | |   | |
    //  | |  | | |__  ___  ___ _ ____   ____ _| |__ | | ___  ___
    //  | |  | | '_ \/ __|/ _ \ '__\ \ / / _` | '_ \| |/ _ \/ __|
    //  | |__| | |_) \__ \  __/ |   \ V / (_| | |_) | |  __/\__ \
    //   \____/|_.__/|___/\___|_|    \_/ \__,_|_.__/|_|\___||___/
    frequentlyUsedEmojis: {} as Record<string, number>,
    note: '',
    isAccessibilityTrusted: false,
    calendarAuthorizationStatus: 'notDetermined' as CalendarAuthorizationStatus,
    onboardingStep: 'v1_start' as OnboardingStep,
    globalShortcut: 'option' as 'command' | 'option' | 'control',
    scratchpadShortcut: 'command' as 'command' | 'option' | 'none',
    clipboardManagerShortcut: 'shift' as 'shift' | 'option' | 'none',
    showWindowOn: 'screenWithFrontmost' as
      | 'screenWithFrontmost'
      | 'screenWithCursor',
    now: DateTime.now(),
    query: '',
    selectedIndex: 0,
    focusedWidget: Widget.SEARCH,
    events: [] as INativeEvent[],
    currentTemp: 0,
    nextHourForecast: null as null | string,
    customItems: [] as Item[],
    apps: [] as Item[],
    favorites: [] as string[],
    isLoading: false,
    translationResults: [] as string[],
    frequencies: {} as Record<string, number>,
    temporaryResult: null as string | null,
    projects: [] as ITrackingProject[],
    tempProjectName: '',
    currentlyTrackedProjectId: null as string | null,
    weatherApiKey: '',
    weatherLat: '',
    weatherLon: '',
    firstTranslationLanguage: 'en' as string,
    secondTranslationLanguage: 'de' as string,
    thirdTranslationLanguage: null as null | string,
    gifs: [] as any[],
    githubSearchEnabled: false,
    githubSearchResults: [] as GithubRepo[],
    // TODO(osp) this token should be placed in secure storage, but too lazy to do it right now
    githubToken: null as string | null,
    fileResults: [] as FileDescription[],
    windowManagementEnabled: true,
    calendarEnabled: true,
    showAllDayEvents: true,
    launchAtLogin: true,
    useBackgroundOverlay: true,
    shouldHideMenubar: false,
    hasFullDiskAccess: false,
    safariBookmarks: [] as {title: string; url: string}[],
    braveBookmarks: [] as {title: string; url: string}[],
    chromeBookmarks: [] as {title: string; url: string}[],
    spotifyForwardingEnabled: true,
    targetHeight: 64,
    //    _____                            _           _
    //   / ____|                          | |         | |
    //  | |     ___  _ __ ___  _ __  _   _| |_ ___  __| |
    //  | |    / _ \| '_ ` _ \| '_ \| | | | __/ _ \/ _` |
    //  | |___| (_) | | | | | | |_) | |_| | ||  __/ (_| |
    //   \_____\___/|_| |_| |_| .__/ \__,_|\__\___|\__,_|
    //                        | |
    //                        |_|
    get favoriteItems(): Item[] {
      const items = [...store.apps, ...ITEMS, ...store.customItems]
      const favorites = store.favorites
        .map(favName => items.find(i => i.name === favName)!)
        .filter(i => i)

      return favorites
    },
    get currentlyTrackedProject(): {
      project: ITrackingProject
      todayTime: number
    } | null {
      const project = store.projects.find(
        p => p.id === store.currentlyTrackedProjectId,
      )
      if (!project) {
        return null
      }
      const todayStartMillis = DateTime.now().startOf('day').valueOf()
      const todayTime = project.periods.reduce((acc, p) => {
        const lStart = DateTime.fromMillis(p.start)
        const lEnd = p.end ? DateTime.fromMillis(p.end) : store.now

        if (lStart.startOf('day').valueOf() === todayStartMillis) {
          acc += lEnd.diff(lStart, 'minutes').minutes
        }

        return acc
      }, 0)

      return {
        project,
        todayTime: Math.floor(todayTime),
      }
    },
    get items(): Item[] {
      if (!store.query) {
        return store.favoriteItems
      }

      const allItems = [
        ...store.apps,
        ...ITEMS.map(i => {
          if (i.name === 'Clipboard Manager') {
            return {
              ...i,
              shortcut:
                store.clipboardManagerShortcut === 'option'
                  ? '⌘ + ⌥ + V'
                  : '⌘ + ⇧ + V',
            }
          }

          return i
        }),
        ...store.customItems,
        ...store.safariBookmarks.map((bookmark): Item => {
          return {
            name: bookmark.title,
            type: ItemType.BOOKMARK,
            iconImage: Assets.Safari,
            callback: () => {
              Linking.openURL(bookmark.url)
            },
          }
        }),
        ...store.braveBookmarks.map((bookmark): Item => {
          return {
            name: bookmark.title,
            type: ItemType.BOOKMARK,
            iconImage: Assets.Brave,
            callback: () => {
              Linking.openURL(bookmark.url)
            },
          }
        }),
        ...store.chromeBookmarks.map((bookmark): Item => {
          return {
            name: bookmark.title,
            type: ItemType.BOOKMARK,
            iconImage: Assets.Chrome,
            callback: () => {
              Linking.openURL(bookmark.url)
            },
          }
        }),
      ]

      if (store.query) {
        let results = new Fuse(allItems, {
          ...FUSE_OPTIONS,
          sortFn: (a: any, b: any) => {
            const freqA = store.frequencies[a.item[0].v] ?? 0
            const freqB = store.frequencies[b.item[0].v] ?? 0
            return freqB - freqA
          },
        })
          .search(store.query)
          .map(r => r.item)

        const temporaryResultItems = !!store.temporaryResult
          ? [{type: ItemType.TEMPORARY_RESULT, name: ''}]
          : []

        const finalResults = [
          ...(CONSTANTS.LESS_VALID_URL.test(store.query)
            ? [
                {
                  type: ItemType.CONFIGURATION,
                  name: 'Open Url',
                  icon: '🌎',
                  callback: () => {
                    if (store.query.startsWith('https://')) {
                      Linking.openURL(store.query)
                    } else {
                      Linking.openURL(`http://${store.query}`)
                    }
                  },
                },
              ]
            : []),
          ...temporaryResultItems,
          ...results,
          ...FALLBACK_ITEMS,
          ...store.fileResults.map(f => ({
            name: f.filename,
            subName:
              f.path.length > 60
                ? `...${f.path.substring(f.path.length - 60, f.path.length)}`
                : f.path,
            type: ItemType.CUSTOM,
            iconComponent: () => <FileIcon url={f.path} className="w-4 h-4" />,
            callback: () => {
              Linking.openURL(f.path)
            },
            metaCallback: () => {
              if (f.kind !== 'Folder') {
                Linking.openURL(f.location)
              }
            },
          })),
        ]

        if (store.githubSearchEnabled) {
          finalResults.concat(
            store.githubSearchResults.map(
              (s): Item => ({
                name: `${s.owner?.login}/${s.name}`,
                type: ItemType.APPLICATION,
                iconComponent: () => {
                  const colorScheme = Appearance.getColorScheme()

                  return (
                    <Image
                      source={Icons.Github}
                      className={clsx('w-3 h-3 p-1 mr-1', {
                        tintColor: colorScheme === 'dark' ? 'white' : 'black',
                      })}
                    />
                  )
                },
                callback: () => {
                  Linking.openURL(s.html_url)
                },
              }),
            ),
          )
        }

        return finalResults
      } else {
        return allItems
      }
    },
    get currentItem(): Item | undefined {
      return store.items[store.selectedIndex]
    },
    //                _   _
    //      /\       | | (_)
    //     /  \   ___| |_ _  ___  _ __  ___
    //    / /\ \ / __| __| |/ _ \| '_ \/ __|
    //   / ____ \ (__| |_| | (_) | | | \__ \
    //  /_/    \_\___|\__|_|\___/|_| |_|___/
    insertEmojiAt(index: number) {
      const favorites = Object.entries(store.frequentlyUsedEmojis).sort(
        ([_, freq1], [_2, freq2]) => freq2 - freq1,
      )

      const data = !!store.query
        ? emojiFuse.search(store.query).map(r => r.item)
        : allEmojis

      let emojiChar = data[index].emoji
      if (favorites.length && !store.query) {
        if (index < EMOJIS_PER_ROW) {
          emojiChar = favorites[index]?.[0]
          if (!emojiChar) {
            return
          }
        } else {
          emojiChar = data[index - EMOJIS_PER_ROW].emoji
        }
      }

      if (store.frequentlyUsedEmojis[emojiChar]) {
        store.frequentlyUsedEmojis[emojiChar] += 1
      } else {
        if (favorites.length === EMOJIS_PER_ROW) {
          let leastUsed = favorites[0]
          favorites.forEach(([emoji, frequency]) => {
            if (frequency < leastUsed[1]) {
              leastUsed = [emoji, frequency]
            }
          })

          delete store.frequentlyUsedEmojis[leastUsed[0]]

          store.frequentlyUsedEmojis[emojiChar] = 1
        } else {
          store.frequentlyUsedEmojis[emojiChar] = 1
        }
      }

      solNative.insertToFrontmostApp(emojiChar)
    },
    setGithubToken: (token: string) => {
      store.githubToken = token
    },
    setGithubSearchEnabled: (v: boolean) => {
      store.githubSearchEnabled = v
    },
    showGifPicker: () => {
      store.focusWidget(Widget.GIFS)
      store.query = ''
      store.searchGifs()
    },
    searchGifs: async () => {
      let gifs: any[] = []

      if (store.query) {
        const {data} = await gf.search(store.query, {limit: 15})
        gifs = data
      } else {
        const {data} = await gf.trending({limit: 15})
        gifs = data
      }

      runInAction(() => {
        store.gifs = gifs
      })
    },
    showEmojiPicker: () => {
      store.focusWidget(Widget.EMOJIS)
      store.query = ''
    },
    showSettings: () => {
      store.focusWidget(Widget.SETTINGS)
    },
    setSelectedIndex: (idx: number) => {
      store.selectedIndex = idx
    },
    setNote: (note: string) => {
      store.note = note
    },
    toggleFavorite: (item: Item) => {
      const favorites = [...store.favorites]

      if (favorites.includes(item.name)) {
        const foundIndex = favorites.indexOf(item.name)
        favorites.splice(foundIndex, 1)
        store.favorites = favorites
      } else {
        if (favorites.length === 5) {
          Alert.alert('Only 5 favorite items allowed.')
          return
        }
        store.setQuery('')
        store.favorites.push(item.name)
      }
    },
    createCustomItem: (item: Item) => {
      store.customItems.push(item)
    },
    translateQuery: async () => {
      store.isLoading = true
      store.translationResults = []
      store.focusedWidget = Widget.TRANSLATION
      store.selectedIndex = 0

      try {
        const translations = await googleTranslate(
          store.firstTranslationLanguage,
          store.secondTranslationLanguage,
          store.thirdTranslationLanguage,
          store.query,
        )

        runInAction(() => {
          store.translationResults = translations
          store.isLoading = false
        })
      } catch (e) {
        runInAction(() => {
          store.isLoading = false
        })
      }
    },
    setFirstTranslationLanguage: (l: string) => {
      store.firstTranslationLanguage = l
    },
    setSecondTranslationLanguage: (l: string) => {
      store.secondTranslationLanguage = l
    },
    setThirdTranslationLanguage: (l: string) => {
      store.thirdTranslationLanguage = l
    },
    setOnboardingStep: (step: OnboardingStep) => {
      store.onboardingStep = step
    },
    setGlobalShortcut: (key: 'command' | 'option' | 'control') => {
      solNative.setGlobalShortcut(key)
      store.globalShortcut = key
    },
    setScratchpadShortcut: (key: 'command' | 'option') => {
      solNative.setScratchpadShortcut(key)
      store.scratchpadShortcut = key
    },
    setShowWindowOn: (on: 'screenWithFrontmost' | 'screenWithCursor') => {
      solNative.setShowWindowOn(on)
      store.showWindowOn = on
    },
    setClipboardManagerShortcut: (key: 'shift' | 'option') => {
      solNative.setClipboardManagerShortcut(key)
      store.clipboardManagerShortcut = key
    },
    setWeatherLat: (lat: string) => {
      store.weatherLat = lat
    },
    setWeatherLon: (lon: string) => {
      store.weatherLon = lon
    },
    setWeatherApiKey: (key: string) => {
      store.weatherApiKey = key
    },
    trackProject: (id: string) => {
      // Stop tracking previous project
      if (store.currentlyTrackedProjectId) {
        store.stopTrackingProject()
      }

      store.currentlyTrackedProjectId = id
      const foundIndex = store.projects.findIndex(p => p.id === id)
      if (foundIndex >= 0) {
        const now = DateTime.now()
        store.now = now
        store.projects[foundIndex].periods.push({
          id: now.toMillis(),
          start: now.toMillis(),
        })
      }
      store.query = ''
    },
    stopTrackingProject: () => {
      const foundIndex = store.projects.findIndex(
        p => p.id === store.currentlyTrackedProjectId,
      )
      if (foundIndex >= 0) {
        store.projects[foundIndex].periods[
          store.projects[foundIndex].periods.length - 1
        ].end = DateTime.now().toMillis()
        store.currentlyTrackedProjectId = null
      }
      store.query = ''
    },
    setTempProjectName: (name: string) => {
      store.tempProjectName = name
    },
    focusWidget: (widget: Widget) => {
      store.selectedIndex = 0
      store.focusedWidget = widget
    },
    createTrackingProject: () => {
      store.projects.push({
        id: new Date().getMilliseconds().toString(),
        name: store.tempProjectName,
        periods: [],
      })
      store.focusedWidget = Widget.PROJECT_SELECT
      store.selectedIndex = 0
      store.tempProjectName = ''
    },
    showProjectCreationForm: () => {
      store.focusedWidget = Widget.PROJECT_CREATION
    },
    setFocus: (widget: Widget) => {
      store.focusedWidget = widget
    },
    setQuery: (query: string) => {
      store.query = query
      store.selectedIndex = 0

      if (store.focusedWidget === Widget.SEARCH) {
        try {
          const res = exprParser.evaluate(store.query)
          if (res && typeof res !== 'function') {
            store.temporaryResult = res.toString()
          } else {
            store.temporaryResult = null
          }
        } catch (e) {
          store.temporaryResult = null
        }

        if (store.githubSearchEnabled) {
          store.searchGithubRepos()
        }

        if (!query) {
          store.fileResults = []
        } else {
          solNative.searchFiles(query)
        }
      }
    },
    searchGithubRepos: debounce(async () => {
      if (store.query && store.focusedWidget === Widget.SEARCH) {
        try {
          runInAction(() => {
            store.githubSearchResults = []
            store.isLoading = true
          })
          const repos = await searchGithubRepos(store.query, store.githubToken)
          runInAction(() => {
            store.isLoading = false
            store.githubSearchResults = repos.items
          })
        } catch (e) {
          runInAction(() => {
            store.isLoading = false
          })
        }
      }
    }, 500),
    runFavorite: (index: number) => {
      const item = store.favoriteItems[index]

      if (!!item && item.type === ItemType.CUSTOM) {
        if (item.text) {
          if (item.isApplescript) {
            solNative.executeAppleScript(item.text)
          } else {
            Linking.openURL(item.text)
          }
        }
      }

      solNative.hideWindow()
    },
    onShow: ({target}: {target?: string}) => {
      if (target === Widget.CLIPBOARD) {
        store.showClipboardManager()
        return
      }

      if (target === Widget.SCRATCHPAD) {
        store.showScratchpad()
        return
      }

      if (target === Widget.EMOJIS) {
        store.showEmojiPicker()
        return
      }

      if (target === Widget.SETTINGS) {
        store.showSettings()
        return
      }
      store.now = DateTime.now()

      if (store.weatherApiKey) {
        getWeather(
          store.weatherApiKey,
          store.weatherLat,
          store.weatherLon,
        ).then(res => {
          runInAction(() => {
            store.currentTemp = res?.temp ? Math.round(res.temp) : 0
            store.nextHourForecast = res?.nextHourForecast ?? null
          })
        })
      }

      if (!store.isAccessibilityTrusted) {
        store.getAccessibilityStatus()
      }

      store.getFullDiskAccessStatus()

      solNative.getApps().then(apps => {
        // Each "app" is a macOS file url, e.g. file:///Applications/SF%20Symbols
        const cleanApps = apps.map(({name, url}) => {
          return {
            type: ItemType.APPLICATION as ItemType.APPLICATION,
            url: decodeURI(url.replace('file://', '')),
            name: name,
          }
        })

        runInAction(() => {
          store.apps = cleanApps
        })
      })
    },
    onHide: () => {
      store.focusedWidget = Widget.SEARCH
      store.setQuery('')
      store.selectedIndex = 0
      store.translationResults = []
    },
    cleanUp: () => {
      onShowListener?.remove()
      onHideListener?.remove()
      onFileSearchListener?.remove()
    },
    getCalendarAccess: () => {
      store.calendarAuthorizationStatus =
        solNative.getCalendarAuthorizationStatus()
    },
    getAccessibilityStatus: () => {
      solNative.getAccessibilityStatus().then(v => {
        runInAction(() => {
          store.isAccessibilityTrusted = v
        })
      })
    },
    showScratchpad: () => {
      store.focusWidget(Widget.SCRATCHPAD)
    },
    showClipboardManager: () => {
      store.query = ''
      store.focusWidget(Widget.CLIPBOARD)
    },
    onFileSearch: (files: FileDescription[]) => {
      store.fileResults = files
    },
    setWindowManagementEnabled: (v: boolean) => {
      store.windowManagementEnabled = v
      solNative.setWindowManagement(v)
    },
    setCalendarEnabled: (v: boolean) => {
      store.calendarEnabled = v
      if (v) {
        root.calendar.poll()
      }
    },
    setShowAllDayEvents: (v: boolean) => {
      store.showAllDayEvents = v
    },
    setLaunchAtLogin: (v: boolean) => {
      store.launchAtLogin = v
      solNative.setLaunchAtLogin(v)
    },
    setUseBackgroundOverlay: (v: boolean) => {
      store.useBackgroundOverlay = v
      solNative.useBackgroundOverlay(v)
    },
    setShouldHideMenuBar: (v: boolean) => {
      store.shouldHideMenubar = v
      if (v) {
        solNative.showToast('Menubar will be blacked out, please wait...')
      } else {
        solNative.showToast('Done, please restore your wallpaper manually')
      }
      solNative.shouldHideMenubar(v)
    },
    getFullDiskAccessStatus: async () => {
      const hasAccess = await solNative.hasFullDiskAccess()
      runInAction(() => {
        store.hasFullDiskAccess = hasAccess
        if (hasAccess) {
          store.getSafariBookmarks()
        }
      })
      store.getBraveBookmarks()
      store.getChromeBookmarks()
    },
    getSafariBookmarks: async () => {
      if (store.hasFullDiskAccess) {
        const safariBookmarks = await solNative.getSafariBookmarks()

        runInAction(() => {
          store.safariBookmarks = safariBookmarks
        })
      }
    },
    getBraveBookmarks: async () => {
      const username = solNative.userName()
      const path = `/Users/${username}/Library/Application Support/BraveSoftware/Brave-Browser/Default/Bookmarks`
      const exists = solNative.exists(path)
      if (exists) {
        const bookmarksString = solNative.readFile(path)
        const OGbookmarks = JSON.parse(bookmarksString)
        let bookmarks = OGbookmarks.roots.bookmark_bar.children.map(
          (v: any) => ({
            title: v.name,
            url: v.url,
          }),
        )

        store.braveBookmarks = bookmarks
      }
    },
    getChromeBookmarks: async () => {
      const username = solNative.userName()
      const path = `/Users/${username}/Library/Application Support/Google/Chrome/Default/Bookmarks`
      const exists = solNative.exists(path)
      if (exists) {
        const bookmarksString = solNative.readFile(path)
        const OGbookmarks = JSON.parse(bookmarksString)
        let bookmarks = OGbookmarks.roots.bookmark_bar.children.map(
          (v: any) => ({
            title: v.name,
            url: v.url,
          }),
        )

        store.chromeBookmarks = bookmarks
      }
    },
    setSpotifyForwardingEnabled: (enabled: boolean) => {
      store.spotifyForwardingEnabled = enabled
      solNative.setSpotifyForwardingEnabled(enabled)
    },
    setTargetHeight: (height: number) => {
      store.targetHeight = height
    },
  })

  hydrate().then(() => {
    autorun(persist)
    store.getCalendarAccess()
    store.getAccessibilityStatus()
    store.getFullDiskAccessStatus()
  })

  onShowListener = solNative.addListener('onShow', store.onShow)
  onHideListener = solNative.addListener('onHide', store.onHide)
  onFileSearchListener = solNative.addListener(
    'onFileSearch',
    store.onFileSearch,
  )

  return store
}
