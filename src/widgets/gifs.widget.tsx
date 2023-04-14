import {Assets} from 'assets'
import clsx from 'clsx'
import {useFullSize} from 'hooks/useFullSize'
import {solNative} from 'lib/SolNative'
import {observer} from 'mobx-react-lite'
import React, {FC, useEffect} from 'react'
import {Image, Text, TextInput, View, ViewStyle} from 'react-native'
import {useStore} from 'store'
import colors from 'tailwindcss/colors'

interface Props {
  style?: ViewStyle
}

export const GifsWidget: FC<Props> = observer(({style}) => {
  const store = useStore()
  useFullSize()

  useEffect(() => {
    solNative.turnOnHorizontalArrowsListeners()
    return () => {
      solNative.turnOffHorizontalArrowsListeners()
    }
  }, [])

  useEffect(() => {
    store.ui.searchGifs()
  }, [store.ui.query])

  return (
    <View style={style} className="flex-1">
      <View className="h-10 pt-3 px-3 justify-center flex-row">
        <TextInput
          autoFocus
          // @ts-expect-error
          enableFocusRing={false}
          value={store.ui.query}
          onChangeText={store.ui.setQuery}
          selectionColor={solNative.accentColor}
          placeholderTextColor={colors.neutral[500]}
          placeholder="Search gifs..."
          className="flex-1"
        />
        <Image
          source={Assets.Giphy}
          className="h-8 w-32"
          resizeMode="contain"
        />
      </View>
      <View className="flex-row flex-wrap px-3">
        {store.ui.gifs.map((gif, index) => {
          return (
            <View
              className={clsx(`p-2 rounded border border-transparent`, {
                'bg-accent bg-opacity-50 dark:bg-opacity-40 border-accentDim':
                  index === store.ui.selectedIndex,
              })}>
              <Image
                source={{uri: gif.images.downsized.url}}
                className="w-31 h-31 rounded"
              />
            </View>
          )
        })}

        {!store.ui.gifs.length && (
          <Text className="text-gray-500 dark:text-gray-400 text-xs">
            No results
          </Text>
        )}
      </View>
    </View>
  )
})
