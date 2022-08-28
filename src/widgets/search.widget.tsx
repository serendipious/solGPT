import {Assets, Icons} from 'assets'
import {FileIcon} from 'components/FileIcon'
import {observer} from 'mobx-react-lite'
import React, {FC, useEffect, useRef} from 'react'
import {
  Animated,
  FlatList,
  Image,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  useColorScheme,
  View,
  ViewStyle,
} from 'react-native'
import {useStore} from 'store'
import {FocusableWidget, Item, ItemType} from 'stores'
import tw from 'tailwind'
import {useDeviceContext} from 'twrnc'

interface Props {
  style?: ViewStyle
}

const LoadingBar = observer(() => {
  const colorScheme = useColorScheme()
  const store = useStore()
  const animatedBorderRef = useRef(
    new Animated.Value(store.ui.isLoading ? 1 : 0),
  )
  const accentColor = tw.color('text-accent')!

  useEffect(() => {
    Animated.timing(animatedBorderRef.current, {
      toValue: store.ui.isLoading ? 1 : 0,
      duration: store.ui.isLoading ? 500 : 100,
      useNativeDriver: false,
    }).start()
  }, [store.ui.isLoading])

  return (
    <Animated.View
      style={[
        tw.style(`border-b mb-1`),
        {
          borderColor: animatedBorderRef.current.interpolate({
            inputRange: [0, 1],
            outputRange: [
              colorScheme === 'dark'
                ? 'rgba(255, 255, 255, .2)'
                : 'rgba(0, 0, 0, .1)',
              accentColor,
            ],
          }),
        },
      ]}
    />
  )
})

export const SearchWidget: FC<Props> = observer(({style}) => {
  useDeviceContext(tw)
  const store = useStore()
  const colorScheme = useColorScheme()
  const focused = store.ui.focusedWidget === FocusableWidget.SEARCH
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
    const isActive = index === store.ui.selectedIndex && focused

    if (item.type === ItemType.TEMPORARY_RESULT) {
      return (
        <View
          key={index}
          style={tw.style(
            `justify-center items-center p-3 m-3 mb-2 rounded bg-opacity-50 dark:bg-opacity-40`,
            {
              'bg-accent': isActive,
            },
          )}>
          <Text
            style={tw.style(`text-xl`, {
              'text-white dark:text-white': isActive,
            })}>
            {store.ui.temporaryResult}
          </Text>
        </View>
      )
    }

    return (
      <View
        key={index}
        style={tw.style(
          `flex-row items-center px-3 rounded bg-opacity-80 dark:bg-opacity-40 py-2`,
          {
            'bg-accent': isActive,
          },
        )}>
        {!!item.url && <FileIcon url={item.url} style={tw`w-4 h-4`} />}
        {item.type !== ItemType.CUSTOM && !!item.icon && (
          <Text style={tw`text-xs`}>{item.icon}</Text>
        )}
        {item.type === ItemType.CUSTOM && !!item.icon && (
          <View
            style={tw`h-4 w-4 bg-gray-100 dark:bg-neutral-800 rounded items-center justify-center`}>
            <Image
              // @ts-expect-error
              source={Icons[item.icon]}
              style={tw.style({
                tintColor: item.color,
                height: 12,
                width: 12,
              })}
            />
          </View>
        )}
        {!!item.iconImage && (
          <Image source={item.iconImage} style={tw`w-4 h-4`} />
        )}
        {/* Somehow this component breaks windows build */}
        {(Platform.OS === 'macos' || Platform.OS === 'ios') &&
          !!item.iconComponent && <item.iconComponent />}
        <Text
          style={tw.style('ml-3 text-sm', {
            'text-white': isActive,
          })}>
          {item.name}
        </Text>
        {!!item.subName && (
          <Text style={tw.style('ml-3 text-sm text-gray-500')}>
            {item.subName}
          </Text>
        )}
        <View style={tw`flex-1`} />
        {isActive && (
          <TouchableOpacity
            onPress={() => {
              store.ui.toggleFavorite(item)
            }}
            style={tw`pr-1`}>
            <Image
              source={item.isFavorite ? Assets.StarFilled : Assets.Star}
              style={tw.style('h-[2.5] w-4', {
                tintColor: 'white',
              })}
              resizeMode="contain"
            />
          </TouchableOpacity>
        )}
        {item.isFavorite && !store.ui.query && (
          <Text
            style={tw.style(`text-gray-500 dark:text-gray-400 text-xs w-6`, {
              'text-white dark:text-white': isActive,
            })}>
            ⌘ {index + 1}
          </Text>
        )}
        {!!item.shortcut && (
          <Text
            style={tw.style(`text-gray-500 dark:text-gray-400 text-xs`, {
              'text-white dark:text-white': isActive,
            })}>
            {item.shortcut}
          </Text>
        )}
      </View>
    )
  }

  return (
    <View
      style={tw.style(style, {
        'flex-1': !!store.ui.query,
      })}>
      <View style={tw`h-12 mt-1 mx-3 flex-row items-center`}>
        <TextInput
          autoFocus
          // @ts-expect-error
          enableFocusRing={false}
          value={store.ui.query}
          onChangeText={store.ui.setQuery}
          ref={inputRef}
          style={tw.style(`flex-1 text-lg`)}
          caretHidden
          placeholderTextColor={
            colorScheme === 'dark'
              ? tw.color('text-gray-500')
              : tw.color('text-gray-400')
          }
          placeholder={'Start searching...'}
          selectionColor={tw.color('text-accent')}
        />
      </View>

      <LoadingBar />

      {!store.ui.query && !!store.ui.items.length && (
        <View style={tw`px-3 pt-1 pb-2`}>
          {items.map((item, index) =>
            renderItem({item: {...item, isFavorite: true}, index}),
          )}
        </View>
      )}

      {!!store.ui.query && (
        <FlatList<Item>
          style={tw`flex-1`}
          windowSize={8}
          contentContainerStyle={tw.style(`flex-grow-1 pl-3 py-1`)}
          ref={listRef}
          data={items}
          keyExtractor={(item, i) => `${item.name}-${item.type}-${i}`}
          renderItem={renderItem}
          showsVerticalScrollIndicator={false}
          // automaticallyAdjustContentInsets={false}
          // contentInset={{top: 0, left: 0, bottom: 0, right: -20}}
        />
      )}
    </View>
  )
})
