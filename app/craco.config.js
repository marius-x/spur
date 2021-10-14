const CracoLessPlugin = require('craco-less');

module.exports = {
  plugins: [
    {
      plugin: CracoLessPlugin,
      options: {
        lessLoaderOptions: {
          lessOptions: {
            modifyVars: {
              '@layout-header-background': '#f0f2f5',
              // https://github.com/ant-design/ant-design/blob/master/components/style/themes/default.less
              '@primary-color': '#24acfc', // '#6c7c80', //'#393733', // '#6c7c80',
              '@body-background': '#f0f2f5', // '#f5f1ee' //, '#393733'
            },
            javascriptEnabled: true,
          },
        },
      },
    },
  ],
};
