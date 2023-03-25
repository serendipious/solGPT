import {Key} from 'components/Key'
import {observer} from 'mobx-react-lite'
import React, {FC} from 'react'
import {Text, View} from 'react-native'
import {useStore} from 'store'
import {ItemType, Widget} from 'stores/ui.store'

export const GeneralWidget: FC = observer(() => {
  const store = useStore()
  return (
    <View className="flex-row items-center border-t border-lightBorder dark:border-darkBorder px-4 py-2 bg-lighter dark:bg-darker">
      {!!store.ui.currentTemp && (
        <View>
          <Text className="text-sm">{store.ui.currentTemp}°</Text>
          <Text className="text-sm dark:text-gray-400 text-gray-500 capitalize">
            {store.ui.nextHourForecast}
          </Text>
        </View>
      )}

      {!!store.ui.currentTemp && !!store.ui.currentlyTrackedProject && (
        <View className="border-l border-lightBorder dark:border-darkBorder h-3 mx-4" />
      )}

      {!!store.ui.currentlyTrackedProject ? (
        <View className="flex-row items-center">
          <Text className="text-sm dark:text-gray-400 text-gray-500 pl-1">
            {store.ui.currentlyTrackedProject.project.name}
          </Text>
          <Text className="text-sm dark:text-gray-400 text-gray-500 pl-1">
            · {Math.floor(store.ui.currentlyTrackedProject.todayTime / 60)}h{' '}
            {store.ui.currentlyTrackedProject.todayTime % 60}m
          </Text>
        </View>
      ) : (
        <View />
      )}

      <View className="flex-1" />
      {store.ui.focusedWidget !== Widget.CALENDAR &&
        !store.ui.query &&
        !!store.calendar.filteredEvents.length && (
          <>
            <Text className="text-xxs mr-1">Appointments</Text>
            <Key title="tab" brRounded />
          </>
        )}
      {!!store.calendar.upcomingEvent &&
        store.ui.focusedWidget === Widget.SEARCH &&
        !store.ui.query && (
          <>
            <Text className="text-xxs dark:text-white ml-3 mr-1">
              Join "{store.calendar.upcomingEvent.title}"
            </Text>
            <Key title="return" primary />
          </>
        )}
      {store.ui.focusedWidget === Widget.SEARCH &&
        !!store.ui.query &&
        store.ui.currentItem?.type === ItemType.CUSTOM && (
          <>
            <Text className="text-xxs dark:text-white mr-1">Delete</Text>
            <Key title="⇧ ⌦" />
          </>
        )}

      {store.ui.focusedWidget === Widget.SEARCH && !!store.ui.query && (
        <>
          <Text className="text-xxs dark:text-white mx-1">Open</Text>
          <Key title="⏎" primary brRounded />
        </>
      )}
      {store.ui.focusedWidget === Widget.CALENDAR && (
        <>
          <Text className="text-xxs dark:text-white mr-1">
            {store.ui.currentItem?.url ? 'Join' : 'Open  '}
          </Text>
          <Key title="⏎" primary brRounded />
        </>
      )}
    </View>
  )
})
