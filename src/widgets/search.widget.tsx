import {Icons} from 'assets'
import clsx from 'clsx'
import {FileIcon} from 'components/FileIcon'
import {LoadingBar} from 'components/LoadingBar'
import {StyledFlatList} from 'components/StyledFlatList'
import {solNative} from 'lib/SolNative'
import {observer} from 'mobx-react-lite'
import React, {FC, useEffect, useRef} from 'react'
import {
  FlatList,
  Image,
  Platform,
  Text,
  TextInput,
  useColorScheme,
  View,
  ViewStyle,
} from 'react-native'
import {useStore} from 'store'
import {ItemType, Widget} from 'stores/ui.store'
import colors from 'tailwindcss/colors'
import customColors from '../colors'

type Props = {
  style?: ViewStyle
  className?: string
}

export const SearchWidget: FC<Props> = observer(({style}) => {
  const store = useStore()
  const colorScheme = useColorScheme()
  const focused = store.ui.focusedWidget === Widget.SEARCH
  const inputRef = useRef<TextInput | null>(null)
  const listRef = useRef<FlatList | null>(null)

  useEffect(() => {
    if (focused && store.ui.items.length) {
      listRef.current?.scrollToIndex({
        index: store.ui.selectedIndex,
        viewOffset: 80,
      })
    }
  }, [focused, store.ui.selectedIndex])

  // assignment to get mobx to update the component
  const items = store.ui.items

  const renderItem = ({item, index}: {item: Item; index: number}) => {
    const isActive = index === store.ui.selectedIndex

    // this is used for things like calculator results
    if (item.type === ItemType.TEMPORARY_RESULT) {
      return (
        <View
          className={'flex-row items-center'}
          style={{
            backgroundColor: isActive ? customColors.accentBg : undefined,
          }}>
          <View
            style={{
              backgroundColor: isActive ? customColors.accent : 'transparent',
            }}
            className={clsx('w-[3px] h-20')}
          />
          <View className={clsx('flex-1 px-4')}>
            <Text className="text-xs text-neutral-600 dark:text-neutral-400">
              {store.ui.query}
            </Text>
            <Text className="text-2xl font-semibold mt-2">
              {store.ui.temporaryResult}
            </Text>
          </View>
        </View>
      )
    }

    return (
      <View
        className={clsx('flex-row items-center')}
        style={{
          backgroundColor: isActive ? customColors.accentBg : undefined,
        }}>
        <View
          style={{
            backgroundColor: isActive ? customColors.accent : 'transparent',
          }}
          className={clsx('w-[3px] h-10 bg-transparent')}
        />
        <View className={clsx('flex-1 flex-row items-center px-4')}>
          {!!item.url && <FileIcon url={item.url} className="w-5 h-5" />}
          {item.type !== ItemType.CUSTOM && !!item.icon && (
            <Text className="text-xs">{item.icon}</Text>
          )}
          {item.type === ItemType.CUSTOM && !!item.icon && (
            <View className="w-5 h-5 rounded items-center justify-center">
              <Image
                // @ts-expect-error
                source={Icons[item.icon]}
                style={{
                  tintColor: item.color,
                  height: 14,
                  width: 14,
                }}
              />
            </View>
          )}
          {!!item.iconImage && (
            <Image
              source={item.iconImage}
              className="w-5 h-5"
              resizeMode="contain"
              style={{
                tintColor:
                  colorScheme === 'dark'
                    ? undefined
                    : isActive
                    ? 'black'
                    : colors.neutral[500],
              }}
            />
          )}
          {/* Somehow this component breaks windows build */}
          {(Platform.OS === 'macos' || Platform.OS === 'ios') &&
            !!item.iconComponent && <item.iconComponent />}
          <Text
            numberOfLines={1}
            className={'ml-3 text-sm text-black dark:text-white max-w-xl'}>
            {item.name}
          </Text>

          <View className="flex-1" />
          {!!item.subName && (
            <Text className="ml-3 text-sm text-neutral-500 dark:text-neutral-300">
              {item.subName}
            </Text>
          )}
          {item.type === ItemType.BOOKMARK && (
            <Text className="dark:text-neutral-300 text-xs">Bookmark</Text>
          )}
          {!!item.shortcut && (
            <View className="flex-row">
              {item.shortcut.split(' ').map((char, i) => (
                <Text
                  key={i}
                  className={clsx('mr-1 text-xs dark:text-neutral-300', {
                    'dark:text-white': isActive,
                  })}>
                  {char}
                </Text>
              ))}
            </View>
          )}
        </View>
      </View>
    )
  }

  return (
    <View
      style={style}
      className={clsx({
        'flex-1': !!store.ui.query,
      })}>
      <TextInput
        autoFocus
        // @ts-expect-error
        enableFocusRing={false}
        value={store.ui.query}
        onChangeText={store.ui.setQuery}
        ref={inputRef}
        className="text-xl my-5 px-4"
        placeholderTextColor={
          colorScheme === 'dark' ? colors.neutral[500] : colors.neutral[300]
        }
        placeholder={'Type a command or search...'}
        selectionColor={solNative.accentColor}
      />

      <LoadingBar />

      {!!store.ui.query && (
        <StyledFlatList
          className="flex-1"
          windowSize={8}
          contentContainerStyle="flex-grow-1"
          ref={listRef}
          data={items}
          keyExtractor={(item: any, i) => `${item.name}-${item.type}-${i}`}
          renderItem={renderItem as any}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  )
})
