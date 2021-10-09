const CracoLessPlugin = require('craco-less');

module.exports = {
  plugins: [
    {
      plugin: CracoLessPlugin,
      options: {
        lessLoaderOptions: {
          lessOptions: {
            modifyVars: {
              '@primary-color': '#6c7c80', //'#393733', // '#6c7c80',
              '@body-background': '#393733', //, '#f5f1ee'
            },
            javascriptEnabled: true,
          },
        },
      },
    },
  ],
};
