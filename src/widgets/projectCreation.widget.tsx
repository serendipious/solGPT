import {Input} from 'components/Input'
import {SolButton} from 'components/SolButton'
import {observer} from 'mobx-react-lite'
import React, {FC} from 'react'
import {Text, TouchableOpacity, View, ViewStyle} from 'react-native'
import {useStore} from 'store'

interface Props {
  style?: ViewStyle
}

export const ProjectCreationWidget: FC<Props> = observer(({style}) => {
  const store = useStore()

  return (
    <View style={style} className="flex-1">
      <TouchableOpacity
        className="border-b border-lightBorder dark:border-darkBorder p-3"
        onPress={() => {
          store.ui.onHide()
        }}>
        <Text>
          <Text className="text-gray-500">←</Text> Create Tracking Project
        </Text>
      </TouchableOpacity>
      <View className="p-3 flex-1">
        <Input
          autoFocus
          value={store.ui.tempProjectName}
          onChangeText={store.ui.setTempProjectName}
          placeholder="Project name"
          className="w-full"
          inputClassName="text-lg"
        />
      </View>
      <View className="border-t border-lightBorder dark:border-darkBorder items-end px-3 py-2">
        <SolButton
          title="Create"
          onPress={() => {
            store.ui.createTrackingProject()
          }}
        />
      </View>
    </View>
  )
})
