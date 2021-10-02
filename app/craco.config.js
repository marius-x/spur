const CracoLessPlugin = require('craco-less');

module.exports = {
  plugins: [
    {
      plugin: CracoLessPlugin,
      options: {
        lessLoaderOptions: {
          lessOptions: {
            modifyVars: {
              '@primary-color': '#6c7c80',
              '@body-background': '#f5f1ee'
            },
            javascriptEnabled: true,
          },
        },
      },
    },
  ],
};
