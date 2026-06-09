const { withAndroidManifest, createRunOncePlugin } = require('@expo/config-plugins');

function withPhoneOnlyScreens(config) {
  return withAndroidManifest(config, (config) => {
    config.modResults.manifest['supports-screens'] = [
      {
        $: {
          'android:smallScreens': 'true',
          'android:normalScreens': 'true',
          'android:largeScreens': 'false',
          'android:xlargeScreens': 'false',
        },
      },
    ];
    return config;
  });
}

module.exports = createRunOncePlugin(withPhoneOnlyScreens, 'with-phone-only-screens');
