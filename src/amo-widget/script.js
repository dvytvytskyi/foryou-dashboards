define(['jquery'], function($) {
  var CustomWidget = function() {
    var self = this;

    this.callbacks = {
      render: function() {
        return true;
      },
      init: function() {
        return true;
      },
      bind_actions: function() {
        // Hook into the form submit event when creating a contact
        $(document).off('submit.dedup_contact').on('submit.dedup_contact', 'form', function(e) {
          var form = $(this);
          
          // Check if this is a contact/lead creation form
          if (form.find('input[name="contacts[name]"]').length === 0 && form.closest('.card-entity-form').length === 0) {
              return true; // Not a contact form
          }

          var phones = [];
          
          // Find phone inputs (AmoCRM custom fields for phone usually have data-code="PHONE")
          form.find('input[data-code="PHONE"], input[name*="[PHONE]"], input[name*="[custom_fields]"]').each(function() {
             var val = $(this).val();
             if (val && typeof val === 'string' && val.trim() !== '') {
                 // Remove non-digits except +
                 var cleaned = val.replace(/[^\d+]/g, '');
                 if (cleaned.length > 5) {
                    phones.push(cleaned);
                 }
             }
          });

          if (phones.length === 0) {
            return true; // No phones to check
          }

          // If we haven't already validated
          if (!form.data('dedup_validated')) {
            e.preventDefault(); // Stop form submission
            e.stopPropagation();

            var promises = phones.map(function(phone) {
               return $.ajax({
                 url: '/api/v4/contacts?query=' + encodeURIComponent(phone),
                 method: 'GET'
               });
            });

            $.when.apply($, promises).done(function() {
                var args = arguments;
                var foundDuplicate = false;
                
                // If only one promise, args is [data, status, jqXHR]
                // If multiple, args is [[data1, ...], [data2, ...]]
                var responses = promises.length === 1 ? [args] : Array.prototype.slice.call(args);

                for (var i = 0; i < responses.length; i++) {
                   var data = responses[i][0];
                   if (data && data._embedded && data._embedded.contacts && data._embedded.contacts.length > 0) {
                       foundDuplicate = true;
                       break;
                   }
                }

                if (foundDuplicate) {
                   // AmoCRM built-in modal
                   AMOCRM.notifications.show_message_error({
                      text: 'Контакт с таким номером телефона уже существует! Пожалуйста, найдите его через поиск и прикрепите к сделке, вместо создания дубля.',
                      header: 'Запрет дублей'
                   });
                   // Flash error
                   form.find('.js-control-phone').addClass('control--error');
                   form.data('dedup_validated', false);
                } else {
                   // No duplicates found, allow submission
                   form.data('dedup_validated', true);
                   form.submit();
                }
            }).fail(function(jqXHR) {
                if (jqXHR.status === 204) {
                    // 204 No Content means no contacts found
                    form.data('dedup_validated', true);
                    form.submit();
                } else {
                    console.error('Dedup widget error:', jqXHR);
                    form.data('dedup_validated', true);
                    form.submit();
                }
            });

            return false;
          }
          
          return true;
        });
        return true;
      },
      settings: function() {
        return true;
      },
      onSave: function() {
        return true;
      },
      destroy: function() {
        $(document).off('submit.dedup_contact');
      }
    };
    return this;
  };

  return CustomWidget;
});
