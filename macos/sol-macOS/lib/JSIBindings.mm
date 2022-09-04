#include "JSIBindings.hpp"
#import "CalendarHelper.h"
#include "SolMacros.h"
#import <Cocoa/Cocoa.h>
#import <EventKit/EKCalendar.h>
#import <EventKit/EKEvent.h>
#import <Foundation/Foundation.h>
#include <iostream>
#import <sol-Swift.h>

namespace sol {

namespace jsi = facebook::jsi;
namespace react = facebook::react;

std::shared_ptr<react::CallInvoker> invoker;
FileSearcher *fileSearcher;
CalendarHelper *calendarHelper;

NSDateFormatter *dateFormatter = [[NSDateFormatter alloc] init];

void install(jsi::Runtime &rt,
             std::shared_ptr<react::CallInvoker> callInvoker) {
  invoker = callInvoker;
  fileSearcher = [[FileSearcher alloc] init];
  calendarHelper = [[CalendarHelper alloc] init];
  dateFormatter.dateFormat = @"yyyy-MM-dd'T'HH:mm:ssZ";

  auto setHeight = HOSTFN("setHeight", 1, []) {
    int height = static_cast<int>(arguments[0].asNumber());
    dispatch_async(dispatch_get_main_queue(), ^{
      AppDelegate *appDelegate =
          (AppDelegate *)[[NSApplication sharedApplication] delegate];
      [appDelegate setHeight:height];
    });

    return {};
  });

  auto resetWindowSize = HOSTFN("resetWindowSize", 0, []) {
    dispatch_async(dispatch_get_main_queue(), ^{
      AppDelegate *appDelegate =
          (AppDelegate *)[[NSApplication sharedApplication] delegate];
      [appDelegate resetSize];
    });

    return {};
  });

  auto hideWindow = HOSTFN("hideWindow", 0, []) {
    dispatch_async(dispatch_get_main_queue(), ^{
      AppDelegate *appDelegate =
          (AppDelegate *)[[NSApplication sharedApplication] delegate];
      [appDelegate hideWindow];
    });

    return {};
  });

  auto searchFiles = HOSTFN("searchFiles", 1, []) {
    auto queryStr = arguments[0].asString(rt).utf8(rt);
    [fileSearcher searchFile:[NSString stringWithUTF8String:queryStr.c_str()]];
    return {};
  });

  // auto getMediaInfo = HOSTFN("getMediaInfo", 0, [=]) {
  //   auto promise =
  //       rt.global()
  //           .getPropertyAsFunction(rt, "Promise")
  //           .callAsConstructor(
  //               rt,
  //               jsi::Function::createFromHostFunction(
  //                   rt, jsi::PropNameID::forAscii(rt, "executor"), 2,
  //                   [=](jsi::Runtime &rt, const jsi::Value &,
  //                       const jsi::Value *promiseArgs,
  //                       size_t count) -> jsi::Value {
  //                     auto resolve =
  //                         std::make_shared<jsi::Value>(rt, promiseArgs[0]);
  //                         dispatch_async(dispatch_get_main_queue(), ^{

  //                           [MediaHelper
  //                            getCurrentMedia:^(
  //                                             NSDictionary<NSString *,
  //                                              NSString *> *mediaInfo) {
  //                                                invoker->invokeAsync([&rt,
  //                                                mediaInfo, resolve] {
  //                                                  auto res =
  //                                                  jsi::Object(rt);
  //                                                  res.setProperty(
  //                                                                  rt,
  //                                                                  "title",
  //                                                                  std::string([[mediaInfo
  //                                                                  objectForKey:@"title"]
  //                                                                               UTF8String]));
  //                                                  res.setProperty(
  //                                                                  rt,
  //                                                                  "artist",
  //                                                                  std::string([[mediaInfo
  //                                                                                objectForKey:@"artist"] UTF8String]));
  //                                                  res.setProperty(
  //                                                                  rt,
  //                                                                  "artwork",
  //                                                                  std::string([[mediaInfo
  //                                                                                objectForKey:@"artwork"] UTF8String]));
  //                                                  res.setProperty(
  //                                                                  rt,
  //                                                                  "bundleIdentifier",
  //                                                                  std::string([[mediaInfo
  //                                                                                objectForKey:@"bundleIdentifier"]
  //                                                                               UTF8String]));
  //                                                  res.setProperty(
  //                                                                  rt,
  //                                                                  "url",
  //                                                                  std::string([[mediaInfo
  //                                                                  objectForKey:@"url"]
  //                                                                               UTF8String]));
  //                                                  resolve->asObject(rt).asFunction(rt).call(
  //                                                                                            rt, std::move(res));
  //                                                });
  //                                              }];
  //                         });

  //                     return {};
  //                   }));

  //   return promise;
  // });

  auto requestCalendarAccess = HOSTFN("requestCalendarAccess", 0, []) {
    auto promiseConstructor = rt.global().getPropertyAsFunction(rt, "Promise");

    auto promise = promiseConstructor.callAsConstructor(rt, HOSTFN("executor", 2, []) {
      auto resolve = std::make_shared<jsi::Value>(rt, arguments[0]);

      [calendarHelper requestCalendarAccess:^{
        resolve->asObject(rt).asFunction(rt).call(rt);
      }];

      return {};
    }));
    return promise;
  });

  auto getCalendarAuthorizationStatus =
      HOSTFN("getCalendarAuthorizationStatus", 0, []) {
    NSString *status = [calendarHelper getCalendarAuthorizationStatus];
    std::string statusStd = std::string([status UTF8String]);
    return jsi::String::createFromUtf8(rt, statusStd);
  });

  auto getEvents = HOSTFN("getEvents", 0, []) {
    NSArray<EKEvent *> *ekEvents = [calendarHelper getEvents];
    auto events = jsi::Array(rt, ekEvents.count);
    NSString *colorString = @"";
    for (int i = 0; i < ekEvents.count; i++) {
      EKEvent *ekEvent = [ekEvents objectAtIndex:i];
      auto color = [[ekEvent calendar] color];

      CGFloat redFloatValue, greenFloatValue, blueFloatValue;
      int redIntValue, greenIntValue, blueIntValue;
      NSString *redHexValue, *greenHexValue, *blueHexValue;

      // Convert the NSColor to the RGB color space before we can access its
      // components
      NSColor *convertedColor =
          [color colorUsingColorSpace:[NSColorSpace genericRGBColorSpace]];

      if (convertedColor) {
        // Get the red, green, and blue components of the color
        [convertedColor getRed:&redFloatValue
                         green:&greenFloatValue
                          blue:&blueFloatValue
                         alpha:NULL];

        // Convert the components to numbers (unsigned decimal integer) between
        // 0 and 255
        redIntValue = redFloatValue * 255.99999f;
        greenIntValue = greenFloatValue * 255.99999f;
        blueIntValue = blueFloatValue * 255.99999f;

        // Convert the numbers to hex strings
        redHexValue = [NSString stringWithFormat:@"%02x", redIntValue];
        greenHexValue = [NSString stringWithFormat:@"%02x", greenIntValue];
        blueHexValue = [NSString stringWithFormat:@"%02x", blueIntValue];

        // Concatenate the red, green, and blue components' hex strings together
        // with a "#"
        colorString = [NSString stringWithFormat:@"#%@%@%@", redHexValue,
                                                 greenHexValue, blueHexValue];
      }

      jsi::Object event = jsi::Object(rt);
      event.setProperty(rt, "id", [[ekEvent eventIdentifier] UTF8String]);
      event.setProperty(rt, "title", [[ekEvent title] UTF8String]);
      if ([ekEvent URL] != NULL) {
        event.setProperty(rt, "url",
                          [[[ekEvent URL] absoluteString] UTF8String]);
      }
      if ([ekEvent notes] != NULL) {
        event.setProperty(rt, "notes", [[ekEvent notes] UTF8String]);
      }

      if ([ekEvent location] != NULL) {
        event.setProperty(rt, "location", [[ekEvent location] UTF8String]);
      }

      event.setProperty(rt, "color", [colorString UTF8String]);
      if ([ekEvent startDate] != NULL) {
        event.setProperty(
            rt, "date",
            [[dateFormatter stringFromDate:[ekEvent startDate]] UTF8String]);
      }
      if ([ekEvent endDate] != NULL) {
        event.setProperty(
            rt, "endDate",
            [[dateFormatter stringFromDate:[ekEvent endDate]] UTF8String]);
      }
      event.setProperty(rt, "isAllDay",
                        jsi::Value(static_cast<bool>([ekEvent isAllDay])));
      event.setProperty(rt, "status",
                        jsi::Value(static_cast<int>([ekEvent status])));

      events.setValueAtIndex(rt, i, event);
    }
    return events;
  });

  jsi::Object module = jsi::Object(rt);

  module.setProperty(rt, "setHeight", std::move(setHeight));
  module.setProperty(rt, "resetWindowSize", std::move(resetWindowSize));
  module.setProperty(rt, "hideWindow", std::move(hideWindow));
  // module.setProperty(rt, "getMediaInfo", std::move(getMediaInfo));
  module.setProperty(rt, "searchFiles", std::move(searchFiles));
  module.setProperty(rt, "requestCalendarAccess",
                     std::move(requestCalendarAccess));
  module.setProperty(rt, "getCalendarAuthorizationStatus",
                     std::move(getCalendarAuthorizationStatus));
  module.setProperty(rt, "getEvents", std::move(getEvents));

  rt.global().setProperty(rt, "__SolProxy", std::move(module));
}

} // namespace sol
