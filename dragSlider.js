// custom sliders plugin
(function( $ ) {
    $.fn.dragSlider = function( action ) {
        var element = this;
        var _o = {
            init: function(){
                var isMoving = false;
                // handle events
                $(element).on('mousedown', function(e){
                    isMoving = true;
                    _o.slideHandler($(this), e);
                });
                $(document).on('mouseup', function(){
                    isMoving = false;
                });
                $(element).on('mousemove', function(e){
                    if(isMoving == false) {
                        return;
                    }
                    _o.slideHandler($(this), e);
                });
            },
            getValue: function(){
                var value = $(element).attr('data-value') || 0;
                value = parseFloat(value);
                return value;
            },
            setValue: function(value, triggerEvent){
                var value = parseFloat(value);
                $(element).attr('data-value', value);
                $('.control-slider-control',$(element)).css('left', 'calc('+ (value * 100) + '% - 5px)');
                if(triggerEvent === false) {
                    $(element).trigger('slider.onsetvalue', [_o]);
                } else {
                    $(element).trigger('slider.onslide', [_o]);
                }
            },
            slideHandler : function(target, e){
                var mousePositionX = e.pageX;
                var startPositionX = $(target).offset().left;
                var endPositionX = startPositionX + $(target).outerWidth();

                var percent = 0;
                var range = (endPositionX - startPositionX);
                var value = (mousePositionX - startPositionX);
                percent = value / range;
                if(percent < 0) {
                    percent = 0;
                }
                if(percent > 1) {
                    percent = 1;
                }
                $(target).attr('data-value', percent);
                $('.control-slider-control',$(target)).css('left', 'calc('+ (percent * 100) + '% - 5px)');
                $(element).trigger('slider.onslide', [_o]);
            }
        };
        if(typeof $(element).data('value') == 'undefined') {
            _o.init();
        }
        return _o;
    };

}( jQuery ));